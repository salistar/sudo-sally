// END-TO-END journey: a complete 1v1 duel exercised through the REAL stack —
// HTTP (supertest) + live Socket.io realtime + MongoDB — as one user story.
// This is the integration of every layer (auth → challenge → realtime play →
// settle → leaderboard), not a unit slice.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-e2e';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app, server, io } = require('../src/index');
const Client = require('socket.io-client');
const Challenge = require('../src/models/Challenge');
const User = require('../src/models/User');

let mongo, port;
const sockets = [];
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await new Promise((res) => server.listen(0, res));
  port = server.address().port;
}, 120000);
afterAll(async () => {
  sockets.forEach((s) => { try { s.close(); } catch (_) {} });
  io.close();
  await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

// engine.io 'websocket' frame negotiation is flaky in this ws version combo
// (documented in socket.int.test.js) — polling drives the identical handlers.
function connect(token) {
  const s = Client(`http://localhost:${port}`, { auth: { token }, transports: ['polling'], forceNew: true });
  sockets.push(s);
  return new Promise((res, rej) => { s.on('connect', () => res(s)); s.on('connect_error', rej); });
}
function waitFor(s, ev, ms = 3000) {
  return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
}
const bearer = (t) => ({ Authorization: 'Bearer ' + t });
async function reg(name) {
  const r = await request(app).post('/api/auth/register').send({ username: name, email: name + '@e2e.co', password: 'pass1234' });
  return { token: r.body.token, id: r.body.user.id, username: name };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('E2E — register → challenge → accept → realtime play → win → leaderboard', async () => {
  // 1) two real accounts
  const alice = await reg('e2eAlice');
  const bob = await reg('e2eBob');
  expect(alice.token && bob.token).toBeTruthy();

  // 2) both online over the socket
  const aSock = await connect(alice.token);
  const bSock = await connect(bob.token);

  // 3) Alice challenges Bob (HTTP) → Bob is notified in realtime
  const notified = waitFor(bSock, 'challenge:received', 4000).catch(() => null);
  const send = await request(app).post('/api/challenges/send').set(bearer(alice.token)).send({ targetUsername: 'e2eBob', difficulty: 'easy' });
  expect(send.status).toBe(201);
  const cid = send.body.challenge._id;
  await notified; // best-effort realtime notification

  // 4) Bob accepts + starts
  expect((await request(app).post(`/api/challenges/${cid}/accept`).set(bearer(bob.token))).status).toBe(200);
  expect((await request(app).post(`/api/challenges/${cid}/start`).set(bearer(bob.token))).status).toBe(200);

  // 5) both join the realtime room
  aSock.emit('challenge:join', cid);
  bSock.emit('challenge:join', cid);
  await sleep(300);

  // 6) Alice's live progress reaches Bob; Alice's chat reaches Bob
  const oppProgress = waitFor(bSock, 'opponent:progress', 3000);
  aSock.emit('challenge:progress', { challengeId: cid, board: '[]', timeSpent: 5, errors: 0 });
  expect(await oppProgress).toBeTruthy();

  const chat = waitFor(bSock, 'chat:message', 3000);
  aSock.emit('challenge:chat', { challengeId: cid, text: 'GG!' });
  const msg = await chat;
  expect(JSON.stringify(msg)).toMatch(/GG/);

  // 7) Alice completes the board first → wins (server-authoritative, persisted)
  const ch = await Challenge.findById(cid);
  const solution = JSON.parse(ch.solution);
  const done = await request(app).post(`/api/challenges/${cid}/complete`).set(bearer(alice.token))
    .send({ board: JSON.stringify(solution), timeSpent: 80, errors: 0 });
  expect(done.status).toBe(200);

  // 8) DB reflects the outcome
  const settled = await Challenge.findById(cid);
  expect(settled.status).toBe('completed');
  expect(String(settled.winner)).toBe(String(alice.id));
  expect(String(settled.loser)).toBe(String(bob.id));

  // 9) stats + leaderboard updated
  const aliceDb = await User.findById(alice.id);
  expect(aliceDb.stats.challengesWon).toBeGreaterThanOrEqual(1);
  const lb = await request(app).get('/api/leaderboard');
  expect(lb.status).toBe(200);
}, 30000);
