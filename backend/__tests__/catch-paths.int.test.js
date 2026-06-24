process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest-int';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_ALLOWED_AUDS = 'test-client.apps.googleusercontent.com';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/index');
const User = require('../src/models/User');
const Challenge = require('../src/models/Challenge');
const Game = require('../src/models/Game');
const ShopItem = require('../src/models/ShopItem');
const Achievement = require('../src/models/Achievement');
const Level = require('../src/models/Level');
const challengeController = require('../src/controllers/challengeController');
const gameController = require('../src/controllers/gameController');

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 120000);
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
afterEach(async () => {
  jest.restoreAllMocks();
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

// The auth middleware itself calls User.findById(decoded.id) before the route
// handler runs. To force ONLY a handler's findById to throw (and let auth pass),
// spy with a passthrough for the first call(s) and throw on a later one.
// `throwOnCall` is 1-based: which invocation should blow up.
function throwOnNthFindById(throwOnCall, err = new Error('db')) {
  const real = User.findById.bind(User);
  let n = 0;
  return jest.spyOn(User, 'findById').mockImplementation((...args) => {
    n += 1;
    if (n === throwOnCall) throw err;
    return real(...args);
  });
}

// Mongoose implements Model.findById(id) as Model.findOne({ _id: id }). So the
// auth middleware's User.findById call ALSO goes through User.findOne. When a
// handler queries User.findOne itself, the auth lookup is call #1 and the
// handler's is call #2 — let #1 pass through and throw only on the Nth.
function throwOnNthFindOne(throwOnCall, err = new Error('db')) {
  const real = User.findOne.bind(User);
  let n = 0;
  return jest.spyOn(User, 'findOne').mockImplementation((...args) => {
    n += 1;
    if (n === throwOnCall) throw err;
    return real(...args);
  });
}

// A complete, valid solved 9x9 Sudoku grid.
const SOLVED = [
  [5,3,4,6,7,8,9,1,2],
  [6,7,2,1,9,5,3,4,8],
  [1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],
  [4,2,6,8,5,3,7,9,1],
  [7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],
  [2,8,7,4,1,9,6,3,5],
  [3,4,5,2,8,6,1,7,9],
];

// ============================================================================
// challengeController.js — getOnlineUsers endpoint + 500 catch paths + edges
// ============================================================================
describe('challengeController — getOnlineUsers (lines 87-107)', () => {
  test('GET /challenges/users/online → 200, lists online others, never self', async () => {
    const a = await reg('on_self');
    const b = await reg('on_other');
    // Mark b clearly online + recently active so it surfaces.
    await User.findByIdAndUpdate(b.id, { isOnline: true, lastActive: new Date() });
    // a is also marked online to exercise the self-filter at line 102-103.
    await User.findByIdAndUpdate(a.id, { isOnline: true, lastActive: new Date() });
    const r = await request(app).get('/api/challenges/users/online').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(Array.isArray(r.body.users)).toBe(true);
    const ids = r.body.users.map((u) => String(u._id));
    expect(ids).toContain(String(b.id));
    expect(ids).not.toContain(String(a.id));   // self never leaks (line 103 filter)
  });

  test('GET /challenges/users/online → 500 when User.find throws (line 106-107)', async () => {
    const a = await reg('on_err');
    jest.spyOn(User, 'find').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/challenges/users/online').set(auth(a.token));
    expect(r.status).toBe(500);
  });
});

describe('challengeController — 500 catch paths', () => {
  async function makeChallenge() {
    const a = await reg('cc_a'); const b = await reg('cc_b');
    const send = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUsername: b.username, difficulty: 'easy' });
    return { a, b, cid: send.body.challenge._id };
  }

  test('sendChallenge → 500 when User.findOne throws (line 199)', async () => {
    const a = await reg('cc_send_err');
    // #1 findOne = auth middleware's findById; #2 = handler's username lookup.
    throwOnNthFindOne(2, new Error('db'));
    const r = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUsername: 'whoever', difficulty: 'easy' });
    expect(r.status).toBe(500);
  });

  test('getMyChallenges → 500 when Challenge.find throws (line 252)', async () => {
    const a = await reg('cc_my_err');
    jest.spyOn(Challenge, 'find').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/challenges/my').set(auth(a.token));
    expect(r.status).toBe(500);
  });

  test('acceptChallenge → 500 when Challenge.findOne throws (line 286)', async () => {
    const { b, cid } = await makeChallenge();
    jest.spyOn(Challenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
    expect(r.status).toBe(500);
  });

  test('declineChallenge → 500 when Challenge.findOne throws (line 310)', async () => {
    const { b, cid } = await makeChallenge();
    jest.spyOn(Challenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post(`/api/challenges/${cid}/decline`).set(auth(b.token));
    expect(r.status).toBe(500);
  });

  test('startChallenge → 500 when Challenge.findOne throws (line 348)', async () => {
    const { b, cid } = await makeChallenge();
    jest.spyOn(Challenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    expect(r.status).toBe(500);
  });

  test('getChallenge → 500 when Challenge.findOne throws (line 372-374)', async () => {
    const { a, cid } = await makeChallenge();
    jest.spyOn(Challenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get(`/api/challenges/${cid}`).set(auth(a.token));
    expect(r.status).toBe(500);
  });

  test('updateProgress → 500 when Challenge.findOne throws (line 409)', async () => {
    const { a, cid } = await makeChallenge();
    jest.spyOn(Challenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).put(`/api/challenges/${cid}/progress`).set(auth(a.token))
      .send({ board: JSON.stringify(SOLVED), timeSpent: 5, errors: 0 });
    expect(r.status).toBe(500);
  });

  test('completeChallenge → 500 when Challenge.findOne throws (line 484)', async () => {
    const { b, cid } = await makeChallenge();
    jest.spyOn(Challenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post(`/api/challenges/${cid}/complete`).set(auth(b.token))
      .send({ board: JSON.stringify(SOLVED), timeSpent: 50, errors: 0 });
    expect(r.status).toBe(500);
  });

  test('abandonChallenge → 409 when the playing claim is lost (line 528)', async () => {
    // Drive a real playing challenge, then make findOneAndUpdate return null so
    // the atomic claim "already settled" branch (line 527-528) is hit.
    const { a, b, cid } = await makeChallenge();
    await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
    await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    jest.spyOn(Challenge, 'findOneAndUpdate').mockResolvedValueOnce(null);
    const r = await request(app).post(`/api/challenges/${cid}/abandon`).set(auth(a.token));
    expect(r.status).toBe(409);
  });

  test('abandonChallenge → 500 when Challenge.findOne throws (line 540)', async () => {
    const { a, cid } = await makeChallenge();
    jest.spyOn(Challenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post(`/api/challenges/${cid}/abandon`).set(auth(a.token));
    expect(r.status).toBe(500);
  });

  test('cancelChallenge → 500 when Challenge.findOne throws (line 564)', async () => {
    const { a, cid } = await makeChallenge();
    jest.spyOn(Challenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).delete(`/api/challenges/${cid}`).set(auth(a.token));
    expect(r.status).toBe(500);
  });

  test('getChallengeStats → 500 when Challenge.countDocuments throws (line 592)', async () => {
    const a = await reg('cc_stat_err');
    jest.spyOn(Challenge, 'countDocuments').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/challenges/stats').set(auth(a.token));
    expect(r.status).toBe(500);
  });
});

describe('challengeController — getChallenge success (line 372)', () => {
  test('participant fetches their own challenge → 200 (success res.json)', async () => {
    const a = await reg('gc_ok_a'); const b = await reg('gc_ok_b');
    const send = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUsername: b.username, difficulty: 'easy' });
    const cid = send.body.challenge._id;
    const r = await request(app).get(`/api/challenges/${cid}`).set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(String(r.body.challenge._id)).toBe(String(cid));
  });
});

describe('challengeController — edge branches', () => {
  test('sendChallenge self via targetUserId → 400 (line 127-128)', async () => {
    const a = await reg('cc_selfid');
    const r = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUserId: String(a.id), difficulty: 'easy' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/yourself/i);
  });

  // determineWinner is exercised directly with crafted progress sub-docs so all
  // win/loss/draw branches (602-606, 625-629) are covered deterministically.
  async function craft(progressOverrides) {
    const a = await reg('dw_a'); const b = await reg('dw_b');
    const ch = await Challenge.create({
      challenger: a.id, challenged: b.id,
      puzzle: JSON.stringify(SOLVED), solution: JSON.stringify(SOLVED),
      difficulty: 'easy', status: 'playing', startedAt: new Date(),
      ...progressOverrides,
    });
    return { a, b, ch };
  }

  test('determineWinner: challenger abandoned only → challenged wins (line 602-603)', async () => {
    const { a, b, ch } = await craft({
      challengerProgress: { board: JSON.stringify(SOLVED), abandoned: true },
      challengedProgress: { board: JSON.stringify(SOLVED) },
    });
    await challengeController._test.determineWinner(ch);
    const after = await Challenge.findById(ch._id);
    expect(after.status).toBe('completed');
    expect(String(after.winner)).toBe(String(b.id));
    expect(String(after.loser)).toBe(String(a.id));
  });

  test('determineWinner: challenged abandoned only → challenger wins (line 605-606)', async () => {
    const { a, b, ch } = await craft({
      challengerProgress: { board: JSON.stringify(SOLVED) },
      challengedProgress: { board: JSON.stringify(SOLVED), abandoned: true },
    });
    await challengeController._test.determineWinner(ch);
    const after = await Challenge.findById(ch._id);
    expect(after.status).toBe('completed');
    expect(String(after.winner)).toBe(String(a.id));
    expect(String(after.loser)).toBe(String(b.id));
  });

  test('determineWinner: both completed, challenged faster → challenged wins (line 625-626)', async () => {
    const { a, b, ch } = await craft({
      challengerProgress: { completed: true, timeSpent: 120, errors: 0 },
      challengedProgress: { completed: true, timeSpent: 30, errors: 0 },
    });
    await challengeController._test.determineWinner(ch);
    const after = await Challenge.findById(ch._id);
    expect(String(after.winner)).toBe(String(b.id));
    expect(String(after.loser)).toBe(String(a.id));
  });

  test('determineWinner: both completed, equal score → draw (line 628-629)', async () => {
    const { ch } = await craft({
      challengerProgress: { completed: true, timeSpent: 60, errors: 0 },
      challengedProgress: { completed: true, timeSpent: 60, errors: 0 },
    });
    await challengeController._test.determineWinner(ch);
    const after = await Challenge.findById(ch._id);
    expect(after.status).toBe('completed');
    expect(after.isDraw).toBe(true);
  });
});

// ============================================================================
// gameController.js — isCompleteValidSudoku branches + 500 catch paths
// ============================================================================
describe('gameController — isCompleteValidSudoku (lines 14-15, 19)', () => {
  const { isCompleteValidSudoku } = gameController._test;

  test('string of wrong length → false (line 14-15)', () => {
    expect(isCompleteValidSudoku('123')).toBe(false);              // !== 81 chars
  });
  test('valid 81-char string solution → true (line 13-15 happy path)', () => {
    const flat = SOLVED.map(r => r.join('')).join('');
    expect(flat.length).toBe(81);
    expect(isCompleteValidSudoku(flat)).toBe(true);
  });
  test('thrown-error path returns false (line 19)', () => {
    // A non-string/non-array `board` whose .length access path makes the typeof
    // branch fall through to grid = board (object), later failing the Array
    // checks → false (exercises the surrounding guard logic).
    expect(isCompleteValidSudoku(null)).toBe(false);
    expect(isCompleteValidSudoku(12345)).toBe(false);
    expect(isCompleteValidSudoku({})).toBe(false);
  });
});

describe('gameController — 500 catch paths', () => {
  async function startGame(token, level = 3) {
    const r = await request(app).post('/api/games/start').set(auth(token)).send({ levelNumber: level });
    return r.body.game._id;
  }

  test('startGame → 500 when Level.findOne throws (line 66)', async () => {
    const a = await reg('g_start_err');
    jest.spyOn(Level, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post('/api/games/start').set(auth(a.token)).send({ levelNumber: 1 });
    expect(r.status).toBe(500);
  });

  test('saveGame → 500 when Game.findOne throws (line 87)', async () => {
    const a = await reg('g_save_err');
    jest.spyOn(Game, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post('/api/games/save').set(auth(a.token))
      .send({ gameId: new mongoose.Types.ObjectId().toString(), currentBoard: '[]', timeSpent: 1, errors: 0 });
    expect(r.status).toBe(500);
  });

  test('completeGame → 500 when Game.findOne throws (line 161-162)', async () => {
    const a = await reg('g_comp_err');
    jest.spyOn(Game, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post('/api/games/complete').set(auth(a.token))
      .send({ gameId: new mongoose.Types.ObjectId().toString(), won: true, board: SOLVED, stars: 3 });
    expect(r.status).toBe(500);
  });

  test('getHistory → 500 when Game.find throws (line 180)', async () => {
    const a = await reg('g_hist_err');
    jest.spyOn(Game, 'find').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/games/history').set(auth(a.token));
    expect(r.status).toBe(500);
  });
});

// ============================================================================
// authController.js — register/login/getMe/guest 500 catch paths
// ============================================================================
describe('authController — 500 catch paths', () => {
  test('register → 500 when User.findOne throws (line 83)', async () => {
    jest.spyOn(User, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post('/api/auth/register')
      .send({ username: 'rerr', email: 'rerr@t.co', password: 'pass1234' });
    expect(r.status).toBe(500);
  });

  test('login → 500 when User.findOne throws (line 133)', async () => {
    await request(app).post('/api/auth/register').send({ username: 'lerr', email: 'lerr@t.co', password: 'pass1234' });
    jest.spyOn(User, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post('/api/auth/login').send({ email: 'lerr@t.co', password: 'pass1234' });
    expect(r.status).toBe(500);
  });

  test('getMe → 500 when handler findById throws (line 143)', async () => {
    const a = await reg('merr');
    throwOnNthFindById(2, new Error('db'));   // #1 = auth middleware, #2 = handler
    const r = await request(app).get('/api/auth/me').set(auth(a.token));
    expect(r.status).toBe(500);
  });

  test('guestLogin → 500 when User.create throws (line 252)', async () => {
    jest.spyOn(User, 'create').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post('/api/auth/guest').send({});
    expect(r.status).toBe(500);
  });
});

describe('authController — Google verify + username-collision edges', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });
  const mockGoogle = (payload) => { global.fetch = jest.fn(async () => ({ ok: true, json: async () => payload })); };
  const claims = (o = {}) => ({
    iss: 'https://accounts.google.com',
    aud: 'test-client.apps.googleusercontent.com',
    sub: 'g-sub-edge', email: 'gedge@gmail.com', email_verified: true,
    name: 'Edge User', given_name: 'Edge',
    exp: Math.floor(Date.now() / 1000) + 3600, ...o,
  });

  test('googleAuth: bad iss claim → 401 (verifyGoogleIdToken line 36)', async () => {
    mockGoogle(claims({ iss: 'https://evil.example.com' }));
    const r = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(r.status).toBe(401);
  });

  test('googleAuth: >50 username collisions → crypto-suffix fallback (lines 189-192)', async () => {
    // Force the while-loop to see a taken username on every probe so it blows
    // past attempt > 50 and falls back to a random crypto suffix (line 192).
    let calls = 0;
    const realFindOne = User.findOne.bind(User);
    jest.spyOn(User, 'findOne').mockImplementation((...args) => {
      // First call inside googleAuth is the googleId lookup; let it return null.
      // The email lookup (when email present) is the 2nd. All subsequent
      // username-existence probes return a truthy stub to force collisions.
      const filter = args[0] || {};
      if (filter.username !== undefined) {
        calls += 1;
        // Keep returning "taken" for the first 60 username probes.
        if (calls <= 60) return Promise.resolve({ _id: 'taken' });
        return Promise.resolve(null);
      }
      return realFindOne(...args);
    });
    mockGoogle(claims({ sub: 'g-collide', email: 'collide@gmail.com', given_name: 'Taken' }));
    const r = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(r.status).toBe(200);
    // base "taken" + 6 hex chars from crypto.randomBytes(3)
    expect(r.body.user.username).toMatch(/^taken[0-9a-f]{6}$/);
  });
});

// ============================================================================
// routes/*.js — catch blocks (inject a DB fault on the queried model)
// ============================================================================
describe('routes — achievements catch blocks', () => {
  test('GET /achievements → 500 when Achievement.find throws (line 13-14)', async () => {
    jest.spyOn(Achievement, 'find').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/achievements');
    expect(r.status).toBe(500);
  });
  test('GET /achievements/me → 500 when handler findById throws (line 32-33)', async () => {
    const a = await reg('ach_me_err');
    throwOnNthFindById(2, new Error('db'));   // #1 = auth, #2 = handler
    const r = await request(app).get('/api/achievements/me').set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('POST /achievements/:id/unlock → 500 when Achievement.findOne throws (line 74-75)', async () => {
    const a = await reg('ach_unl_err');
    jest.spyOn(Achievement, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post('/api/achievements/whatever/unlock').set(auth(a.token));
    expect(r.status).toBe(500);
  });
});

describe('routes — daily catch blocks', () => {
  test('GET /daily → 500 when DailyChallenge.findOne throws (line 29-30)', async () => {
    const a = await reg('dly_err');
    const DailyChallenge = require('../src/models/DailyChallenge');
    jest.spyOn(DailyChallenge, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/daily').set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('POST /daily/complete → 500 when handler findById throws (line 78-79)', async () => {
    const a = await reg('dly_comp_err');
    throwOnNthFindById(2, new Error('db'));   // #1 = auth, #2 = handler
    const r = await request(app).post('/api/daily/complete').set(auth(a.token))
      .send({ timeSpent: 30, errors: 0, stars: 3 });
    expect(r.status).toBe(500);
  });
});

describe('routes — levels catch blocks', () => {
  test('GET /levels → 500 when Level.find throws (line 21-22)', async () => {
    const a = await reg('lv_err');
    jest.spyOn(Level, 'find').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/levels').set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('GET /levels/:id → 500 when Level.findOne throws (line 33-34)', async () => {
    const a = await reg('lv_one_err');
    jest.spyOn(Level, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/levels/1').set(auth(a.token));
    expect(r.status).toBe(500);
  });
});

describe('routes — shop catch blocks', () => {
  test('GET /shop → 500 when ShopItem.find throws (line 13-14)', async () => {
    jest.spyOn(ShopItem, 'find').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/shop');
    expect(r.status).toBe(500);
  });
  test('POST /shop/buy → 500 when ShopItem.findOne throws (line 59-60)', async () => {
    const a = await reg('shop_buy_err');
    jest.spyOn(ShopItem, 'findOne').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).post('/api/shop/buy').set(auth(a.token)).send({ itemId: 'whatever' });
    expect(r.status).toBe(500);
  });
  test('POST /shop/buy → 400 Unknown powerup when effect key not on user (line 49)', async () => {
    await ShopItem.create({
      itemId: 'pow_bogus', type: 'powerup', name: { en: 'Bogus' },
      price: 10, discount: 0, isActive: true,
      powerupData: { effect: 'not_a_real_powerup', quantity: 1 },
    });
    const a = await reg('shop_pow_unknown');
    const r = await request(app).post('/api/shop/buy').set(auth(a.token)).send({ itemId: 'pow_bogus' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/unknown powerup/i);
  });
});

describe('routes — stats catch blocks', () => {
  test('GET /stats → 500 when User.countDocuments throws (line 27-28)', async () => {
    jest.spyOn(User, 'countDocuments').mockImplementationOnce(() => { throw new Error('db'); });
    const r = await request(app).get('/api/stats');
    expect(r.status).toBe(500);
  });
  test('GET /stats/me → 500 when handler findById throws (line 49-50)', async () => {
    const a = await reg('st_me_err');
    throwOnNthFindById(2, new Error('db'));   // #1 = auth, #2 = handler
    const r = await request(app).get('/api/stats/me').set(auth(a.token));
    expect(r.status).toBe(500);
  });
});
