// Regression tests locking in the deep-audit bug fixes.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-audit';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/index');
const User = require('../src/models/User');
const Challenge = require('../src/models/Challenge');

let mongo;
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); }, 120000);
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
afterEach(async () => { for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({}); });

let seq = 0;
async function reg(name) {
  const u = `${name}${++seq}`;
  const r = await request(app).post('/api/auth/register').send({ username: u, email: `${u}@a.co`, password: 'pass1234' });
  return { token: r.body.token, id: (r.body.user || {})._id || (r.body.user || {}).id, username: u };
}
const auth = (t) => ({ Authorization: 'Bearer ' + t });
async function startSolo(token, levelNumber, isDaily = false) {
  const s = await request(app).post('/api/games/start').set(auth(token)).send({ levelNumber, isDaily });
  return (s.body.game || {})._id;
}

describe('Audit fixes — economy/integrity', () => {
  test('BUG-P0-1: solo completeGame is idempotent — a replay does NOT double-credit', async () => {
    const a = await reg('idem');
    const gameId = await startSolo(a.token, 1);
    const c1 = await request(app).post('/api/games/complete').set(auth(a.token)).send({ gameId, won: true, timeSpent: 60, errors: 0, stars: 3 });
    expect(c1.status).toBe(200);
    const u1 = await User.findById(a.id);
    const c2 = await request(app).post('/api/games/complete').set(auth(a.token)).send({ gameId, won: true, timeSpent: 60, errors: 0, stars: 3 });
    expect(c2.status).toBe(200);
    expect(c2.body.alreadyCompleted).toBe(true);
    const u2 = await User.findById(a.id);
    expect(u2.xp).toBe(u1.xp);                       // not re-credited
    expect(u2.coins).toBe(u1.coins);
    expect(u2.stats.gamesWon).toBe(u1.stats.gamesWon);
  });

  test('BUG-5: a legitimate win with 0 stars still grants reward (>0 xp)', async () => {
    const a = await reg('floor');
    const gameId = await startSolo(a.token, 5);
    const c = await request(app).post('/api/games/complete').set(auth(a.token)).send({ gameId, won: true, timeSpent: 9999, errors: 0, stars: 0 });
    expect(c.status).toBe(200);
    expect(c.body.rewards.xp).toBeGreaterThan(0);
  });

  test('BUG-7: a daily solo game does not pollute completedLevels nor the solo streak', async () => {
    const a = await reg('dly');
    const gameId = await startSolo(a.token, 3, true);
    await request(app).post('/api/games/complete').set(auth(a.token)).send({ gameId, won: true, timeSpent: 60, errors: 0, stars: 3 });
    const u = await User.findById(a.id);
    expect(u.completedLevels).not.toContain(3);
    expect(u.stats.currentStreak).toBe(0);
  });

  test('BUG-2: both players gain stats.challengesPlayed after a duel', async () => {
    const a = await reg('cpa'); const b = await reg('cpb');
    const send = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: b.username, difficulty: 'easy' });
    const cid = send.body.challenge._id;
    await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
    await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    const ch = await Challenge.findById(cid);
    await request(app).post(`/api/challenges/${cid}/complete`).set(auth(b.token)).send({ board: ch.solution, timeSpent: 60, errors: 0 });
    const ua = await User.findById(a.id); const ub = await User.findById(b.id);
    expect(ub.stats.challengesPlayed).toBe(1);   // winner
    expect(ua.stats.challengesPlayed).toBe(1);   // loser
  });

  test('BUG-3: negative timeSpent/errors are clamped on progress (no tiebreak cheat)', async () => {
    const a = await reg('clp'); const b = await reg('clpb');
    const send = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: b.username, difficulty: 'easy' });
    const cid = send.body.challenge._id;
    await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
    await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    await request(app).put(`/api/challenges/${cid}/progress`).set(auth(a.token)).send({ board: '[]', timeSpent: -99999, errors: -50 });
    const ch = await Challenge.findById(cid);
    expect(ch.challengerProgress.timeSpent).toBeGreaterThanOrEqual(0);
    expect(ch.challengerProgress.errors).toBeGreaterThanOrEqual(0);
  });

  test('RANK-2: /me rank uses the stars→gamesWon tiebreak (matches the board)', async () => {
    const a = await reg('ra'); const b = await reg('rb'); const c = await reg('rc');
    await User.updateOne({ _id: a.id }, { $set: { stars: 10, 'stats.gamesWon': 5 } });
    await User.updateOne({ _id: b.id }, { $set: { stars: 10, 'stats.gamesWon': 3 } });
    await User.updateOne({ _id: c.id }, { $set: { stars: 10, 'stats.gamesWon': 1 } });
    const rb = await request(app).get('/api/leaderboard/me').set(auth(b.token));
    expect(rb.status).toBe(200);
    expect(rb.body.rank).toBe(2);   // a(5 wins) above b; c(1) below → b is #2
  });
});

describe('Audit fixes — ranking', () => {
  test('RANK-1: weekly leaderboard aggregates REAL wins this week (was a dead stub)', async () => {
    const Game = require('../src/models/Game');
    const a = await reg('wk');
    await Game.create({ user: a.id, level: 1, status: 'won', stars: 3, completedAt: new Date() });
    const r = await request(app).get('/api/leaderboard/weekly');
    expect(r.status).toBe(200);
    const me = (r.body.leaderboard || []).find((e) => String(e.userId) === String(a.id));
    expect(me).toBeTruthy();
    expect(me.weeklyStars).toBeGreaterThanOrEqual(3);
  });

  test('RANK-9: guests are excluded from the public leaderboards', async () => {
    const g = await request(app).post('/api/auth/guest').send({});
    const gid = (g.body.user || {})._id || (g.body.user || {}).id;
    await User.updateOne({ _id: gid }, { $set: { stars: 99999, 'stats.gamesWon': 999 } });
    const r = await request(app).get('/api/leaderboard');
    expect(r.status).toBe(200);
    expect(r.body.leaderboard.some((e) => String(e.userId) === String(gid))).toBe(false);
  });
});

describe('Audit fixes — live-broadcast privacy', () => {
  test('SEC-5: /spectate is 403 for a non-participant until BOTH players consent', async () => {
    const a = await reg('sa'); const b = await reg('sb'); const c = await reg('sc'); // c = outsider
    const send = await request(app).post('/api/challenges/send').set(auth(a.token)).send({ targetUsername: b.username, difficulty: 'easy' });
    const cid = send.body.challenge._id;
    await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));

    // Outsider, no consent → blocked (was a privacy leak — anyone could watch).
    const denied = await request(app).get(`/api/challenges/${cid}/spectate`).set(auth(c.token));
    expect(denied.status).toBe(403);

    // A participant can always view their own match.
    const own = await request(app).get(`/api/challenges/${cid}/spectate`).set(auth(a.token));
    expect(own.status).toBe(200);

    // Both consented (the go-live handshake sets this) → outsider may watch.
    await Challenge.updateOne({ _id: cid }, { $set: { 'broadcast.consented': true } });
    const allowed = await request(app).get(`/api/challenges/${cid}/spectate`).set(auth(c.token));
    expect(allowed.status).toBe(200);
  });
});
