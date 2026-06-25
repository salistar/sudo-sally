process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest-int';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_ALLOWED_AUDS = 'test-client.apps.googleusercontent.com';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: Client } = require('socket.io-client');
const { app, server, io } = require('../src/index');
const socketService = require('../src/services/socketService');

let mongo;
let port;
const clients = [];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
}, 120000);

afterAll(async () => {
  for (const c of clients) {
    try { if (c && c.connected) c.disconnect(); } catch (_) {}
  }
  try { io.close(); } catch (_) {}
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

// ============ HELPERS ============
let seq = 0;
async function reg(name) {
  const u = `${name}${++seq}`;
  const r = await request(app)
    .post('/api/auth/register')
    .send({ username: u, email: `${u}@t.co`, password: 'pass1234' });
  const user = r.body.user || {};
  return { token: r.body.token, id: user._id || user.id, username: u };
}

const auth = (t) => ({ Authorization: 'Bearer ' + t });

function connect(token) {
  return new Promise((resolve, reject) => {
    const sock = Client(`http://localhost:${port}`, {
      auth: token === undefined ? {} : { token },
      // NOTE: the bundled ws@8 server + client negotiate a permessage-deflate
      // frame the client's ws rejects over loopback (RangeError: RSV1 must be
      // clear), so the 'websocket' transport handshake fails in this exact dep
      // set. 'polling' (long-poll / XHR) drives the IDENTICAL server-side
      // socketService.js handlers — the handlers are transport-agnostic — so it
      // gives the same coverage without the ws-version incompatibility.
      transports: ['polling'],
      forceNew: true,
    });
    clients.push(sock);
    const t = setTimeout(() => reject(new Error('connect timeout')), 4000);
    sock.on('connect', () => { clearTimeout(t); resolve(sock); });
    sock.on('connect_error', (err) => { clearTimeout(t); reject(err); });
  });
}

function expectConnectError(token) {
  return new Promise((resolve, reject) => {
    const opts = { transports: ['polling'], forceNew: true };
    if (token !== undefined) opts.auth = { token };
    const sock = Client(`http://localhost:${port}`, opts);
    clients.push(sock);
    const t = setTimeout(() => reject(new Error('expected connect_error, got none')), 4000);
    sock.on('connect', () => { clearTimeout(t); reject(new Error('unexpectedly connected')); });
    sock.on('connect_error', (err) => { clearTimeout(t); resolve(err); });
  });
}

function waitFor(sock, ev, ms = 1500) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      sock.off(ev, handler);
      reject(new Error(`timeout waiting for "${ev}"`));
    }, ms);
    function handler(payload) {
      clearTimeout(t);
      sock.off(ev, handler);
      resolve(payload);
    }
    sock.on(ev, handler);
  });
}

// Wait for an event whose payload matches a predicate. Needed for presence
// broadcasts (user:online / user:offline) which the server emits to EVERY
// connected socket — including sockets still alive from earlier tests — so the
// FIRST event isn't necessarily the one we triggered.
function waitForMatch(sock, ev, pred, ms = 1500) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      sock.off(ev, handler);
      reject(new Error(`timeout waiting for matching "${ev}"`));
    }, ms);
    function handler(payload) {
      if (!pred(payload)) return;
      clearTimeout(t);
      sock.off(ev, handler);
      resolve(payload);
    }
    sock.on(ev, handler);
  });
}

function notReceived(sock, ev, ms = 800) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      sock.off(ev, handler);
      resolve(true);
    }, ms);
    function handler() {
      clearTimeout(t);
      sock.off(ev, handler);
      resolve(false);
    }
    sock.on(ev, handler);
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Build a real A→B challenge that both users are participants of.
async function makeChallenge(a, b) {
  const send = await request(app)
    .post('/api/challenges/send')
    .set(auth(a.token))
    .send({ targetUsername: b.username, difficulty: 'easy' });
  const cid = send.body.challenge._id;
  await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
  return cid;
}

// ============ AUTH MIDDLEWARE ============
describe('Socket auth', () => {
  test('valid token connects', async () => {
    const a = await reg('auth_ok');
    const sock = await connect(a.token);
    expect(sock.connected).toBe(true);
    sock.disconnect();
  });

  test('missing token → connect_error', async () => {
    const err = await expectConnectError(undefined);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Authentication required/i);
  });

  test('garbage token → connect_error (Invalid token)', async () => {
    const err = await expectConnectError('not-a-real-jwt');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Invalid token/i);
  });
});

// ============ PRESENCE ============
describe('Presence', () => {
  test('a 2nd user connecting → 1st gets user:online; then heartbeat + users:list', async () => {
    const a = await reg('pres_a');
    const b = await reg('pres_b');

    const sockA = await connect(a.token);
    const onlineP = waitForMatch(sockA, 'user:online', (p) => p.odcUserId === String(b.id));
    const sockB = await connect(b.token);
    const payload = await onlineP;
    expect(payload.odcUserId).toBe(String(b.id));
    expect(payload.username).toBe(b.username);

    // heartbeat: just emits, no crash, no ack expected
    sockA.emit('heartbeat');
    await delay(100);
    expect(sockA.connected).toBe(true);

    // users:list → users:online (b should be present, isOnline set on connect)
    sockA.emit('users:list');
    const list = await waitFor(sockA, 'users:online');
    expect(Array.isArray(list)).toBe(true);

    sockA.disconnect();
    sockB.disconnect();
  });

  test('on disconnect others receive user:offline', async () => {
    const a = await reg('off_a');
    const b = await reg('off_b');
    const sockA = await connect(a.token);
    const sockB = await connect(b.token);
    await delay(100);

    const offlineP = waitForMatch(sockA, 'user:offline', (p) => p.odcUserId === String(b.id));
    sockB.disconnect();
    const payload = await offlineP;
    expect(payload.odcUserId).toBe(String(b.id));
    sockA.disconnect();
  });
});

// ============ ROOM MEMBERSHIP & RELAYS ============
describe('Challenge rooms', () => {
  test('participants join via challenge:join; non-participant join is ignored', async () => {
    const a = await reg('room_a');
    const b = await reg('room_b');
    const c = await reg('room_c'); // not a participant
    const cid = await makeChallenge(a, b);

    const sockA = await connect(a.token);
    const sockB = await connect(b.token);
    const sockC = await connect(c.token);

    sockA.emit('challenge:join', cid);
    sockB.emit('challenge:join', cid);
    sockC.emit('challenge:join', cid); // ignored — c is not in the challenge
    await delay(300);

    // A emits chat → B (in room) receives, C (not in room) does NOT
    const bGot = waitFor(sockB, 'chat:message');
    const cNot = notReceived(sockC, 'chat:message');
    sockA.emit('challenge:chat', { challengeId: cid, text: 'hello B' });
    const msg = await bGot;
    expect(msg.text).toBe('hello B');
    expect(msg.from).toBe(a.username);
    expect(await cNot).toBe(true);

    sockA.disconnect(); sockB.disconnect(); sockC.disconnect();
  });

  test('challenge:spectate is DENIED without consent, ALLOWED once both players consent', async () => {
    const Challenge = require('../src/models/Challenge');
    const a = await reg('spec_a');
    const b = await reg('spec_b');
    const s = await reg('spec_s'); // spectator, not a participant
    const cid = await makeChallenge(a, b);

    const sockA = await connect(a.token);
    const sockS = await connect(s.token);

    sockA.emit('challenge:join', cid);

    // 1) No consent yet → spectate is refused (privacy gate).
    const denied = waitFor(sockS, 'spectate:denied');
    sockS.emit('challenge:spectate', cid);
    const d = await denied;
    expect(d.reason).toBe('not_consented');

    // 2) Both players consent → spectate works and relays player:completed.
    await Challenge.updateOne({ _id: cid }, { $set: { 'broadcast.consented': true } });
    sockS.emit('challenge:spectate', cid);
    await delay(200);
    const specGot = waitFor(sockS, 'player:completed');
    sockA.emit('challenge:completed', { challengeId: cid, timeSpent: 50, errors: 1 });
    const p = await specGot;
    expect(p.odcUserId).toBe(String(a.id));

    sockA.disconnect(); sockS.disconnect();
  });

  test('chat from a non-room user is NOT relayed', async () => {
    const a = await reg('chatx_a');
    const b = await reg('chatx_b');
    const cid = await makeChallenge(a, b);

    const sockA = await connect(a.token);
    const sockB = await connect(b.token);

    sockA.emit('challenge:join', cid);
    sockB.emit('challenge:join', cid);
    await delay(300);

    // B leaves the room, then tries to chat → A should NOT receive it
    sockB.emit('challenge:leave', cid);
    await delay(200);
    const aNot = notReceived(sockA, 'chat:message');
    sockB.emit('challenge:chat', { challengeId: cid, text: 'sneaky' });
    expect(await aNot).toBe(true);

    sockA.disconnect(); sockB.disconnect();
  });
});

// ============ WebRTC + CALL relays ============
describe('WebRTC signaling', () => {
  test('offer / answer / ice / call:end relay in-room', async () => {
    const a = await reg('rtc_a');
    const b = await reg('rtc_b');
    const cid = await makeChallenge(a, b);

    const sockA = await connect(a.token);
    const sockB = await connect(b.token);
    sockA.emit('challenge:join', cid);
    sockB.emit('challenge:join', cid);
    await delay(300);

    // Clients send the SDP as an RTCSessionDescription OBJECT ({ type, sdp }),
    // NOT a bare string — the relay must accept and forward it verbatim.
    const offerSdp = { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\nm=video 9 UDP/TLS/RTP/SAVPF\r\n' };
    const offerP = waitFor(sockB, 'webrtc:offer');
    sockA.emit('webrtc:offer', { challengeId: cid, sdp: offerSdp });
    expect((await offerP).sdp).toEqual(offerSdp);

    const answerSdp = { type: 'answer', sdp: 'v=0\r\no=- 2 2 IN IP4 0.0.0.0\r\nm=audio 9 UDP/TLS/RTP/SAVPF\r\n' };
    const answerP = waitFor(sockA, 'webrtc:answer');
    sockB.emit('webrtc:answer', { challengeId: cid, sdp: answerSdp });
    expect((await answerP).sdp).toEqual(answerSdp);

    const iceP = waitFor(sockB, 'webrtc:ice');
    sockA.emit('webrtc:ice', { challengeId: cid, candidate: 'CAND' });
    expect((await iceP).candidate).toBe('CAND');

    const endP = waitFor(sockB, 'call:end');
    sockA.emit('call:end', { challengeId: cid });
    expect((await endP).from).toBe(String(a.id));

    sockA.disconnect(); sockB.disconnect();
  });

  test('webrtc:offer from a non-room user is dropped', async () => {
    const a = await reg('rtcx_a');
    const b = await reg('rtcx_b');
    const cid = await makeChallenge(a, b);

    const sockA = await connect(a.token);
    const sockB = await connect(b.token);
    sockB.emit('challenge:join', cid); // only B joins
    await delay(300);

    const bNot = notReceived(sockB, 'webrtc:offer');
    sockA.emit('webrtc:offer', { challengeId: cid, sdp: 'X' }); // A not in room
    expect(await bNot).toBe(true);

    sockA.disconnect(); sockB.disconnect();
  });
});

// ============ LIVE-STREAM handshake relays ============
describe('Live-stream handshake', () => {
  test('request / accept / decline / end relay in-room', async () => {
    const a = await reg('live_a');
    const b = await reg('live_b');
    const cid = await makeChallenge(a, b);

    const sockA = await connect(a.token);
    const sockB = await connect(b.token);
    sockA.emit('challenge:join', cid);
    sockB.emit('challenge:join', cid);
    await delay(300);

    const reqP = waitFor(sockB, 'live:request');
    sockA.emit('live:request', { challengeId: cid, platform: 'youtube' });
    const req = await reqP;
    expect(req.from).toBe(String(a.id));
    expect(req.platform).toBe('youtube');

    const accP = waitFor(sockA, 'live:accept');
    sockB.emit('live:accept', { challengeId: cid });
    expect((await accP).from).toBe(String(b.id));

    const decP = waitFor(sockA, 'live:decline');
    sockB.emit('live:decline', { challengeId: cid });
    expect((await decP).from).toBe(String(b.id));

    const endP = waitFor(sockB, 'live:end');
    sockA.emit('live:end', { challengeId: cid });
    expect((await endP).from).toBe(String(a.id));

    sockA.disconnect(); sockB.disconnect();
  });
});

// ============ GAME FLOW relays ============
describe('Challenge game flow', () => {
  test('completed → player:completed; abandoned → player:abandoned; finished → challenge:result; progress → opponent:progress', async () => {
    const a = await reg('flow_a');
    const b = await reg('flow_b');
    const cid = await makeChallenge(a, b);

    const sockA = await connect(a.token);
    const sockB = await connect(b.token);
    sockA.emit('challenge:join', cid);
    sockB.emit('challenge:join', cid);
    await delay(300);

    // progress: A → B (not echoed to A)
    const progP = waitFor(sockB, 'opponent:progress');
    sockA.emit('challenge:progress', {
      challengeId: cid, board: 'BOARD', timeSpent: 3, errors: 0,
      cellUpdated: { row: 0, col: 0, value: 5 },
    });
    const prog = await progP;
    expect(prog.odcUserId).toBe(String(a.id));
    expect(prog.board).toBe('BOARD');

    // completed
    const compP = waitFor(sockB, 'player:completed');
    sockA.emit('challenge:completed', { challengeId: cid, timeSpent: 60, errors: 2 });
    expect((await compP).username).toBe(a.username);

    // abandoned
    const abP = waitFor(sockB, 'player:abandoned');
    sockA.emit('challenge:abandoned', { challengeId: cid });
    expect((await abP).odcUserId).toBe(String(a.id));

    // finished → challenge:result
    const resP = waitFor(sockB, 'challenge:result');
    sockA.emit('challenge:finished', {
      challengeId: cid, winner: String(a.id), loser: String(b.id), isDraw: false,
    });
    const res = await resP;
    expect(res.challengeId).toBe(cid);
    expect(res.winner).toBe(String(a.id));

    sockA.disconnect(); sockB.disconnect();
  });

  test('challenge:start → challenge:started; send → challenge:received; accepted/declined relays', async () => {
    const a = await reg('flow2_a');
    const b = await reg('flow2_b');
    const cid = await makeChallenge(a, b);

    const sockA = await connect(a.token);
    const sockB = await connect(b.token);
    sockA.emit('challenge:join', cid);
    sockB.emit('challenge:join', cid);
    await delay(300);

    // challenge:start broadcasts to room → A (also in room) receives
    const startP = waitFor(sockA, 'challenge:started');
    sockB.emit('challenge:start', { challengeId: cid });
    expect((await startP).challengeId).toBe(cid);

    // challenge:send → target (B) receives challenge:received by userSockets map
    const recvP = waitFor(sockB, 'challenge:received');
    sockA.emit('challenge:send', { targetUserId: String(b.id), difficulty: 'easy' });
    const recv = await recvP;
    expect(recv.odcChallengerId).toBe(String(a.id));

    // challenge:accepted → room gets challenge:status, challenger gets challenge:accepted
    const statusP = waitFor(sockA, 'challenge:status');
    const accP = waitFor(sockA, 'challenge:accepted');
    sockB.emit('challenge:accepted', { challengeId: cid });
    expect((await statusP).status).toBe('accepted');
    expect((await accP).challengeId).toBe(cid);

    // challenge:declined → challenger (A) gets challenge:declined
    const decP = waitFor(sockA, 'challenge:declined');
    sockB.emit('challenge:declined', { challengeId: cid });
    expect((await decP).challengeId).toBe(cid);

    sockA.disconnect(); sockB.disconnect();
  });
});

// ============ EXPORTED HELPERS (notifyUser / broadcast / lookups) ============
describe('Service helper exports', () => {
  test('getSocketForUser / isUserOnline / getOnlineUsersCount track a live socket', async () => {
    const a = await reg('help_a');
    const sock = await connect(a.token);
    await delay(150);

    expect(socketService.isUserOnline(String(a.id))).toBe(true);
    expect(typeof socketService.getSocketForUser(String(a.id))).toBe('string');
    expect(socketService.getOnlineUsersCount()).toBeGreaterThan(0);
    // Unknown user → not online / no socket.
    expect(socketService.isUserOnline('000000000000000000000000')).toBe(false);
    expect(socketService.getSocketForUser('000000000000000000000000')).toBeUndefined();

    sock.disconnect();
  });

  test('notifyUser pushes an event to a connected user; false for unknown', async () => {
    const a = await reg('notif_a');
    const sock = await connect(a.token);
    await delay(150);

    const gotP = waitFor(sock, 'custom:ping');
    const delivered = socketService.notifyUser(String(a.id), 'custom:ping', { hello: 'world' });
    expect(delivered).toBe(true);
    expect((await gotP).hello).toBe('world');

    // No socket for this id → returns false.
    expect(socketService.notifyUser('000000000000000000000000', 'custom:ping', {})).toBe(false);

    sock.disconnect();
  });

  test('broadcast emits to every connected socket', async () => {
    const a = await reg('bc_a');
    const sock = await connect(a.token);
    await delay(150);

    const gotP = waitFor(sock, 'global:notice');
    const ok = socketService.broadcast('global:notice', { msg: 'hi all' });
    expect(ok).toBe(true);
    expect((await gotP).msg).toBe('hi all');

    sock.disconnect();
  });

  test('challenge:spectate ignores a non-string id (type guard) and a bad id', async () => {
    const a = await reg('specg_a');
    const sock = await connect(a.token);

    // Non-string id → handler returns early, no crash.
    sock.emit('challenge:spectate', 12345);
    // String but not a real challenge → findById returns null, no join, no crash.
    sock.emit('challenge:spectate', '000000000000000000000000');
    await delay(200);
    expect(sock.connected).toBe(true);

    sock.disconnect();
  });
});
