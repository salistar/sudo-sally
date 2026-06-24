process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest-int';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_ALLOWED_AUDS = 'test-client.apps.googleusercontent.com';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/index');
const Challenge = require('../src/models/Challenge');
const Achievement = require('../src/models/Achievement');

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 120000);
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
afterEach(async () => {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
});

let seq = 0;
async function reg(name) {
  const u = `${name}${++seq}`;
  const r = await request(app).post('/api/auth/register').send({ username: u, email: `${u}@t.co`, password: 'pass1234' });
  const user = r.body.user || {};
  return { token: r.body.token, id: user._id || user.id, username: u, status: r.status };
}
const auth = (t) => ({ Authorization: 'Bearer ' + t });

// ============ AUTH ============
describe('Auth', () => {
  test('register returns a token + user', async () => {
    const a = await reg('alice');
    expect(a.status).toBe(201);
    expect(a.token).toBeTruthy();
    expect(a.id).toBeTruthy();
  });
  test('guest login works', async () => {
    const r = await request(app).post('/api/auth/guest').send({});
    expect([200, 201]).toContain(r.status);
    expect(r.body.token).toBeTruthy();
  });
  test('/me requires a valid token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const a = await reg('mealice');
    const ok = await request(app).get('/api/auth/me').set(auth(a.token));
    expect(ok.status).toBe(200);
  });
  test('NoSQL-injection login attempt is neutralized', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(r.status).not.toBe(200);
  });
});

// ============ CHALLENGE LIFECYCLE (first-completer wins) ============
describe('Challenge lifecycle', () => {
  async function pair() {
    const a = await reg('ca'); const b = await reg('cb');
    const send = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: b.username, difficulty: 'easy' });
    return { a, b, send };
  }
  test('send → accept → start → complete: FIRST completer wins + persisted', async () => {
    const { a, b, send } = await pair();
    expect(send.status).toBe(201);
    const cid = send.body.challenge._id;
    expect((await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token))).status).toBe(200);
    await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    const ch = await Challenge.findById(cid);
    const solution = JSON.parse(ch.solution);
    const done = await request(app).post(`/api/challenges/${cid}/complete`).set(auth(b.token))
      .send({ board: JSON.stringify(solution), timeSpent: 90, errors: 0 });
    expect(done.status).toBe(200);
    const after = await Challenge.findById(cid);
    expect(after.status).toBe('completed');
    expect(String(after.winner)).toBe(String(b.id));     // first completer wins
    expect(String(after.loser)).toBe(String(a.id));
  });
  test('abandon settles to the opponent as winner', async () => {
    const { a, b, send } = await pair();
    const cid = send.body.challenge._id;
    await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
    await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    const ab = await request(app).post(`/api/challenges/${cid}/abandon`).set(auth(a.token));
    expect(ab.status).toBe(200);
    const after = await Challenge.findById(cid);
    expect(after.status).toBe('completed');
    expect(String(after.winner)).toBe(String(b.id));     // a abandoned → b wins
  });
  test('"already exists" rule blocks a duplicate', async () => {
    const { a, b, send } = await pair();
    expect(send.status).toBe(201);
    const dup = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: b.username, difficulty: 'easy' });
    expect(dup.status).toBe(400);
  });
  test('cannot challenge yourself', async () => {
    const a = await reg('selfx');
    const r = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: a.username, difficulty: 'easy' });
    expect(r.status).toBe(400);
  });
  test('IDOR: a non-participant cannot read the challenge', async () => {
    const { send } = await pair();
    const cid = send.body.challenge._id;
    const c = await reg('intruder');
    expect((await request(app).get(`/api/challenges/${cid}`).set(auth(c.token))).status).toBe(404);
  });
});

// ============ SECURITY FIXES (this session) ============
describe('Security fixes', () => {
  test('H1: GET /users/:id for a non-owner exposes NO email', async () => {
    const a = await reg('sa'); const b = await reg('sb');
    const r = await request(app).get(`/api/users/${b.id}`).set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.user.username).toBe(b.username);
    expect(r.body.user.email).toBeUndefined();
  });
  test('H1: GET /users (list all) is forbidden for non-admins', async () => {
    const a = await reg('la');
    expect((await request(app).get('/api/users').set(auth(a.token))).status).toBe(403);
  });
  test('H2: cannot overwrite another user\'s settings', async () => {
    const a = await reg('xa'); const b = await reg('xb');
    const r = await request(app).put(`/api/users/${b.id}/settings`).set(auth(a.token)).send({ language: 'ar' });
    expect(r.status).toBe(403);
  });
  test('H3: achievement unlock is denied when criteria are not met', async () => {
    await Achievement.create({ achievementId: 'win10', icon: '🏆', requirement: { type: 'games_won', target: 10 }, rewards: { xp: 500, coins: 250 }, isActive: true });
    const a = await reg('acha');
    const r = await request(app).post('/api/achievements/win10/unlock').set(auth(a.token));
    expect(r.status).toBe(403);   // 0 games won < 10
  });
});

// ============ MODERATION (UGC) — report + block ============
describe('Moderation (UGC)', () => {
  test('submit a report → 201', async () => {
    const a = await reg('rep_a'); const b = await reg('rep_b');
    const r = await request(app).post('/api/reports').set(auth(a.token))
      .send({ reportedUser: b.id, reason: 'harassment', detail: 'abusive chat', context: 'chat' });
    expect(r.status).toBe(201);
    expect(r.body.reportId).toBeTruthy();
  });
  test('block prevents challenging in BOTH directions', async () => {
    const a = await reg('blk_a'); const b = await reg('blk_b');
    expect((await request(app).post(`/api/users/${b.id}/block`).set(auth(a.token))).status).toBe(200);
    const c1 = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: b.username, difficulty: 'easy' });
    expect(c1.status).toBe(403);
    const c2 = await request(app).post('/api/challenges/send').set(auth(b.token)).send({ targetUsername: a.username, difficulty: 'easy' });
    expect(c2.status).toBe(403);
  });
  test('cannot block yourself', async () => {
    const a = await reg('blkself');
    expect((await request(app).post(`/api/users/${a.id}/block`).set(auth(a.token))).status).toBe(400);
  });
  test('unblock restores challenging', async () => {
    const a = await reg('unb_a'); const b = await reg('unb_b');
    await request(app).post(`/api/users/${b.id}/block`).set(auth(a.token));
    await request(app).post(`/api/users/${b.id}/unblock`).set(auth(a.token));
    const c = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: b.username, difficulty: 'easy' });
    expect(c.status).toBe(201);
  });
});

// ============ AUTH — full (email/password + Google) ============
describe('Auth full', () => {
  test('register → 201 + token + username', async () => {
    const r = await request(app).post('/api/auth/register').send({ username: 'newby', email: 'newby@t.co', password: 'pass1234' });
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.username).toBe('newby');
  });
  test('register duplicate email → 400', async () => {
    await request(app).post('/api/auth/register').send({ username: 'd1', email: 'dupe@t.co', password: 'pass1234' });
    const r = await request(app).post('/api/auth/register').send({ username: 'd2', email: 'dupe@t.co', password: 'pass1234' });
    expect(r.status).toBe(400);
  });
  test('login: valid 200 · wrong password 401 · unknown 401', async () => {
    await request(app).post('/api/auth/register').send({ username: 'lg', email: 'lg@t.co', password: 'pass1234' });
    expect((await request(app).post('/api/auth/login').send({ email: 'lg@t.co', password: 'pass1234' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 'lg@t.co', password: 'WRONG' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'no@t.co', password: 'x' })).status).toBe(401);
  });
  test('guest → 201 isGuest, no password leaked, 50 coins', async () => {
    const r = await request(app).post('/api/auth/guest').send({});
    expect(r.status).toBe(201);
    expect(r.body.isGuest).toBe(true);
    expect(r.body.user.password).toBeUndefined();
    expect(r.body.user.coins).toBe(50);
  });
  test('/me: valid 200 · no token 401 · garbage 401', async () => {
    const a = await reg('meu');
    expect((await request(app).get('/api/auth/me').set(auth(a.token))).status).toBe(200);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth('garbage.token.x'))).status).toBe(401);
  });

  // --- Google sign-in (mock Google's tokeninfo endpoint) ---
  const realFetch = global.fetch;
  const mockGoogle = (payload) => { global.fetch = jest.fn(async () => ({ ok: true, json: async () => payload })); };
  const claims = (o = {}) => ({ iss: 'https://accounts.google.com', aud: 'test-client.apps.googleusercontent.com', sub: 'g-sub-1', email: 'guser@gmail.com', email_verified: true, name: 'Idriss Kriouile', given_name: 'Idriss', exp: Math.floor(Date.now() / 1000) + 3600, ...o });
  afterEach(() => { global.fetch = realFetch; });

  test('Google: new user → username from name, NOT Guest_xx', async () => {
    mockGoogle(claims());
    const r = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(r.status).toBe(200);
    expect(r.body.provider).toBe('google');
    expect(r.body.user.username).toMatch(/^idriss/);
    expect(r.body.user.username).not.toMatch(/^Guest_/);
  });
  test('Google: same sub → same account', async () => {
    mockGoogle(claims({ sub: 'g-same', email: 'same@gmail.com' }));
    const r1 = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    mockGoogle(claims({ sub: 'g-same', email: 'same@gmail.com' }));
    const r2 = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(r1.body.user.id).toBe(r2.body.user.id);
  });
  test('Google: links to an existing email/password account', async () => {
    await request(app).post('/api/auth/register').send({ username: 'linku', email: 'link@gmail.com', password: 'pass1234' });
    mockGoogle(claims({ sub: 'g-link', email: 'link@gmail.com' }));
    const r = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(r.status).toBe(200);
    expect(r.body.user.username).toBe('linku');
  });
  test('Google: wrong audience → 401', async () => {
    mockGoogle(claims({ aud: 'attacker.apps.googleusercontent.com' }));
    expect((await request(app).post('/api/auth/google').send({ idToken: 'fake' })).status).toBe(401);
  });
  test('Google: missing idToken → 400', async () => {
    expect((await request(app).post('/api/auth/google').send({})).status).toBe(400);
  });
  test('Google: accepts the web "credential" field too', async () => {
    mockGoogle(claims({ sub: 'g-web', email: 'web@gmail.com', given_name: 'Sally' }));
    const r = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(r.status).toBe(200);
    expect(r.body.user.username).toMatch(/^sally/);
  });
});

// ============ GAMES / LEADERBOARD / DAILY / STATS ============
describe('Games + misc controllers', () => {
  test('solo game start → 201', async () => {
    const a = await reg('gm');
    const r = await request(app).post('/api/games/start').set(auth(a.token)).send({ levelNumber: 1, isDaily: false });
    expect([200, 201]).toContain(r.status);
  });
  test('game history → 200', async () => {
    const a = await reg('gh');
    expect((await request(app).get('/api/games/history').set(auth(a.token))).status).toBe(200);
  });
  test('leaderboard global → 200 array; /me → rank', async () => {
    const a = await reg('lb');
    expect((await request(app).get('/api/leaderboard')).status).toBe(200);
    const me = await request(app).get('/api/leaderboard/me').set(auth(a.token));
    expect(me.status).toBe(200);
  });
  test('daily → 200', async () => {
    const a = await reg('dl');
    expect((await request(app).get('/api/daily').set(auth(a.token))).status).toBe(200);
  });
  test('stats/me → 200', async () => {
    const a = await reg('st');
    expect((await request(app).get('/api/stats/me').set(auth(a.token))).status).toBe(200);
  });
});

// ============ MORE ENDPOINTS (routes coverage) ============
describe('More endpoints', () => {
  test('challenge slice aliases never 500', async () => {
    const a = await reg('sl');
    for (const p of ['pending', 'sent', 'active', 'history']) {
      expect((await request(app).get('/api/challenges/' + p).set(auth(a.token))).status).toBe(200);
    }
  });
  test('achievements /me → 200', async () => {
    const a = await reg('achme');
    expect((await request(app).get('/api/achievements/me').set(auth(a.token))).status).toBe(200);
  });
  test('levels + shop lists → 200', async () => {
    const a = await reg('lvl');
    expect((await request(app).get('/api/levels').set(auth(a.token))).status).toBe(200);
    expect((await request(app).get('/api/shop')).status).toBe(200);
  });
  test('public profile by username → 200 (public fields only)', async () => {
    const a = await reg('pubp');
    const r = await request(app).get('/api/users/by-username/' + a.username);
    expect(r.status).toBe(200);
    expect((r.body.user || {}).email).toBeUndefined();
  });
  test('progress write + spectate (no solution) + replay gating', async () => {
    const a = await reg('pa'); const b = await reg('pb');
    const send = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: b.username, difficulty: 'easy' });
    const cid = send.body.challenge._id;
    await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
    await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    const ch = await Challenge.findById(cid);
    const puzzle = JSON.parse(ch.puzzle);
    expect((await request(app).put(`/api/challenges/${cid}/progress`).set(auth(b.token)).send({ board: JSON.stringify(puzzle), timeSpent: 5, errors: 0 })).status).toBe(200);
    const sp = await request(app).get(`/api/challenges/${cid}/spectate`).set(auth(a.token));
    expect(sp.status).toBe(200);
    expect(JSON.stringify(sp.body)).not.toContain('"solution"');     // never leaks solution
    expect((await request(app).get(`/api/challenges/${cid}/replay`).set(auth(a.token))).status).toBe(404);  // mid-game gated
    const sol = JSON.parse(ch.solution);
    await request(app).post(`/api/challenges/${cid}/complete`).set(auth(b.token)).send({ board: JSON.stringify(sol), timeSpent: 60, errors: 0 });
    expect((await request(app).get(`/api/challenges/${cid}/replay`).set(auth(b.token))).status).toBe(200);
  });
});
