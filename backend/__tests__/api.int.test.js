process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest-int';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

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
