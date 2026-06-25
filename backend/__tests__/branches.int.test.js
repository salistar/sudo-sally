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
const User = require('../src/models/User');
const ShopItem = require('../src/models/ShopItem');
const Achievement = require('../src/models/Achievement');
const Level = require('../src/models/Level');
const Game = require('../src/models/Game');
const challengeController = require('../src/controllers/challengeController');

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

// A complete, valid solved 9x9 Sudoku grid (used to claim a win).
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

// ============ CHALLENGE CONTROLLER — error-path branches ============
describe('challengeController branches', () => {
  async function makeChallenge() {
    const a = await reg('br_ca'); const b = await reg('br_cb');
    const send = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUsername: b.username, difficulty: 'easy' });
    return { a, b, cid: send.body.challenge._id, send };
  }

  test('accept a non-pending (already accepted) challenge → 404', async () => {
    const { b, cid } = await makeChallenge();
    expect((await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token))).status).toBe(200);
    // second accept: status is now 'accepted', not 'pending' → 404
    const r = await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
    expect(r.status).toBe(404);
  });

  test('start a non-accepted (still pending) challenge → 404', async () => {
    const { b, cid } = await makeChallenge();
    const r = await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    expect(r.status).toBe(404);
  });

  test('complete a non-playing (pending) challenge → 404', async () => {
    const { b, cid } = await makeChallenge();
    const r = await request(app).post(`/api/challenges/${cid}/complete`).set(auth(b.token))
      .send({ board: JSON.stringify(SOLVED), timeSpent: 50, errors: 0 });
    expect(r.status).toBe(404);
  });

  test('abandon a non-playing (pending) challenge → 404', async () => {
    const { a, cid } = await makeChallenge();
    const r = await request(app).post(`/api/challenges/${cid}/abandon`).set(auth(a.token));
    expect(r.status).toBe(404);
  });

  test('sendChallenge with a targetUsername that does not exist → 404', async () => {
    const a = await reg('br_send');
    const r = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUsername: 'definitely_no_such_user_xyz', difficulty: 'easy' });
    expect(r.status).toBe(404);
    expect(r.body.error).toMatch(/not found/i);
  });

  test('sendChallenge with a targetUserId that does not exist → 404', async () => {
    const a = await reg('br_send2');
    const ghost = new mongoose.Types.ObjectId().toString();
    const r = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUserId: ghost, difficulty: 'easy' });
    expect(r.status).toBe(404);
  });

  test('cancel (DELETE) by the CHALLENGED (not the challenger) → 404', async () => {
    const { b, cid } = await makeChallenge();
    // b is the challenged; only the challenger may cancel a pending challenge.
    const r = await request(app).delete(`/api/challenges/${cid}`).set(auth(b.token));
    expect(r.status).toBe(404);
    // a challenge still pending and untouched
    const still = await Challenge.findById(cid);
    expect(still.status).toBe('pending');
  });

  test('cancel (DELETE) by the challenger → 200 + cancelled', async () => {
    const { a, cid } = await makeChallenge();
    const r = await request(app).delete(`/api/challenges/${cid}`).set(auth(a.token));
    expect(r.status).toBe(200);
    const after = await Challenge.findById(cid);
    expect(after.status).toBe('cancelled');
  });

  test('decline a pending challenge by the challenged → 200', async () => {
    const { b, cid } = await makeChallenge();
    const r = await request(app).post(`/api/challenges/${cid}/decline`).set(auth(b.token));
    expect(r.status).toBe(200);
    const after = await Challenge.findById(cid);
    expect(after.status).toBe('declined');
  });

  test('decline a non-pending challenge → 404', async () => {
    const { b, cid } = await makeChallenge();
    await request(app).post(`/api/challenges/${cid}/decline`).set(auth(b.token));
    const r = await request(app).post(`/api/challenges/${cid}/decline`).set(auth(b.token));
    expect(r.status).toBe(404);
  });

  test('updateProgress on a non-playing challenge → 404', async () => {
    const { a, cid } = await makeChallenge();
    const r = await request(app).put(`/api/challenges/${cid}/progress`).set(auth(a.token))
      .send({ board: JSON.stringify(SOLVED), timeSpent: 10, errors: 0 });
    expect(r.status).toBe(404);
  });

  test('updateProgress on a playing challenge by challenged → 200 (records moves)', async () => {
    const { a, b, cid } = await makeChallenge();
    await request(app).post(`/api/challenges/${cid}/accept`).set(auth(b.token));
    await request(app).post(`/api/challenges/${cid}/start`).set(auth(b.token));
    const ch = await Challenge.findById(cid);
    const board = JSON.parse(ch.puzzle);
    // place a few digits so recordMoves diffs something
    board[0][0] = 5; board[0][1] = 3;
    const r = await request(app).put(`/api/challenges/${cid}/progress`).set(auth(a.token))
      .send({ board: JSON.stringify(board), timeSpent: 12, errors: 1 });
    expect(r.status).toBe(200);
  });

  test('both-players-abandon → draw path (via determineWinner helper)', async () => {
    // The HTTP abandon route atomically settles on the FIRST abandon, so the
    // both-abandon draw branch in determineWinner is exercised directly here
    // with a doc whose both progress sub-docs are abandoned (== game allows).
    const a = await reg('br_dra'); const b = await reg('br_drb');
    const ch = await Challenge.create({
      challenger: a.id,
      challenged: b.id,
      puzzle: JSON.stringify(SOLVED),
      solution: JSON.stringify(SOLVED),
      difficulty: 'easy',
      status: 'playing',
      startedAt: new Date(),
      challengerProgress: { board: JSON.stringify(SOLVED), abandoned: true },
      challengedProgress: { board: JSON.stringify(SOLVED), abandoned: true },
    });
    await challengeController._test.determineWinner(ch);
    const after = await Challenge.findById(ch._id);
    expect(after.status).toBe('completed');
    expect(after.isDraw).toBe(true);
    // both players got the draw reward (xp 30 / coins 15)
    const ua = await User.findById(a.id);
    const ub = await User.findById(b.id);
    expect(ua.xp).toBe(30); expect(ua.coins).toBe(115);
    expect(ub.xp).toBe(30); expect(ub.coins).toBe(115);
  });

  test('determineWinner: both completed → fastest score wins', async () => {
    const a = await reg('br_bca'); const b = await reg('br_bcb');
    const ch = await Challenge.create({
      challenger: a.id, challenged: b.id,
      puzzle: JSON.stringify(SOLVED), solution: JSON.stringify(SOLVED),
      difficulty: 'easy', status: 'playing', startedAt: new Date(),
      challengerProgress: { completed: true, timeSpent: 30, errors: 0 },
      challengedProgress: { completed: true, timeSpent: 90, errors: 0 },
    });
    await challengeController._test.determineWinner(ch);
    const after = await Challenge.findById(ch._id);
    expect(after.status).toBe('completed');
    expect(String(after.winner)).toBe(String(a.id)); // a was faster
  });

  test('getMyChallenges /pending /sent /active /history slices for a user with data', async () => {
    const a = await reg('br_my_a'); const b = await reg('br_my_b');
    const c = await reg('br_my_c'); const d = await reg('br_my_d');
    // a → b pending (a's sent, b's pending) — will be driven to completed (history)
    const s1 = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUsername: b.username, difficulty: 'easy' });
    const cid1 = s1.body.challenge._id;
    // c → a pending (a's received/pending)
    await request(app).post('/api/challenges/send').set(auth(c.token))
      .send({ targetUsername: a.username, difficulty: 'easy' });
    // a → d, accept + start → active (playing). Separate pair so the
    // "already exists" rule doesn't block it.
    const s3 = await request(app).post('/api/challenges/send').set(auth(a.token))
      .send({ targetUsername: d.username, difficulty: 'easy' });
    const cid3 = s3.body.challenge._id;
    await request(app).post(`/api/challenges/${cid3}/accept`).set(auth(d.token));
    await request(app).post(`/api/challenges/${cid3}/start`).set(auth(d.token));

    // a → b completed (history): accept, start, a completes with valid board
    await request(app).post(`/api/challenges/${cid1}/accept`).set(auth(b.token));
    await request(app).post(`/api/challenges/${cid1}/start`).set(auth(b.token));
    await request(app).post(`/api/challenges/${cid1}/complete`).set(auth(a.token))
      .send({ board: JSON.stringify(SOLVED), timeSpent: 40, errors: 0 });

    const my = await request(app).get('/api/challenges/my').set(auth(a.token));
    expect(my.status).toBe(200);
    expect(my.body.success).toBe(true);
    expect(Array.isArray(my.body.sent)).toBe(true);

    const pending = await request(app).get('/api/challenges/pending').set(auth(a.token));
    expect(pending.status).toBe(200);
    expect(Array.isArray(pending.body.received)).toBe(true);
    expect(pending.body.received.length).toBeGreaterThanOrEqual(1);

    const sent = await request(app).get('/api/challenges/sent').set(auth(a.token));
    expect(sent.status).toBe(200);
    expect(Array.isArray(sent.body.sent)).toBe(true);

    const active = await request(app).get('/api/challenges/active').set(auth(a.token));
    expect(active.status).toBe(200);
    expect(Array.isArray(active.body.active)).toBe(true);
    expect(active.body.active.length).toBeGreaterThanOrEqual(1);

    const history = await request(app).get('/api/challenges/history').set(auth(a.token));
    expect(history.status).toBe(200);
    expect(Array.isArray(history.body.history)).toBe(true);
    expect(history.body.history.length).toBeGreaterThanOrEqual(1);
  });

  test('getChallengeStats returns win/loss/total counts', async () => {
    const a = await reg('br_stat');
    const r = await request(app).get('/api/challenges/stats').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.stats).toBeTruthy();
    expect(r.body.stats.winRate).toBe(0); // no completed challenges
  });
});

// ============ GAME CONTROLLER — POST /api/games/complete ============
describe('gameController complete', () => {
  async function startGame(token, level = 3) {
    const r = await request(app).post('/api/games/start').set(auth(token)).send({ levelNumber: level });
    return r.body.game._id;
  }

  test('complete with a VALID solved board → win + rewards credited', async () => {
    const a = await reg('g_win');
    const gid = await startGame(a.token, 3);
    const before = await User.findById(a.id);
    const r = await request(app).post('/api/games/complete').set(auth(a.token))
      .send({ gameId: gid, won: true, timeSpent: 100, errors: 0, hintsUsed: 0, stars: 3, board: SOLVED });
    expect(r.status).toBe(200);
    expect(r.body.game.status).toBe('won');
    expect(r.body.rewards.stars).toBe(3);
    expect(r.body.rewards.xp).toBeGreaterThan(0);
    expect(r.body.rewards.coins).toBeGreaterThan(0);
    const after = await User.findById(a.id);
    expect(after.xp).toBeGreaterThan(before.xp);
    expect(after.coins).toBeGreaterThan(before.coins);
    expect(after.stars).toBe(before.stars + 3);
    expect(after.stats.gamesWon).toBe(1);
    expect(after.stats.perfectGames).toBe(1); // 0 errors
  });

  test('complete with an INVALID/incomplete board claiming won → rejected, no reward', async () => {
    const a = await reg('g_cheat');
    const gid = await startGame(a.token, 3);
    const bogus = SOLVED.map(row => [...row]);
    bogus[0][0] = bogus[0][1]; // break row 0 uniqueness
    const r = await request(app).post('/api/games/complete').set(auth(a.token))
      .send({ gameId: gid, won: true, timeSpent: 100, errors: 0, hintsUsed: 0, stars: 3, board: bogus });
    expect(r.status).toBe(200);
    expect(r.body.game.status).toBe('lost');
    expect(r.body.rewards.stars).toBe(0);
    const after = await User.findById(a.id);
    expect(after.stars).toBe(0);
    expect(after.stats.gamesWon).toBe(0);
    expect(after.stats.gamesPlayed).toBe(1); // counted as played, streak reset
    expect(after.stats.currentStreak).toBe(0);
  });

  test('complete clamps absurd stars (stars:999 → 3) on a valid win', async () => {
    const a = await reg('g_clamp');
    const gid = await startGame(a.token, 1);
    const r = await request(app).post('/api/games/complete').set(auth(a.token))
      .send({ gameId: gid, won: true, timeSpent: 50, errors: 0, hintsUsed: 0, stars: 999, board: SOLVED });
    expect(r.status).toBe(200);
    expect(r.body.rewards.stars).toBe(3); // clamped 0-3
    const after = await User.findById(a.id);
    expect(after.stars).toBe(3);
  });

  test('complete an unknown gameId → 404', async () => {
    const a = await reg('g_404');
    const ghost = new mongoose.Types.ObjectId().toString();
    const r = await request(app).post('/api/games/complete').set(auth(a.token))
      .send({ gameId: ghost, won: true, board: SOLVED, stars: 3 });
    expect(r.status).toBe(404);
  });

  test('start increments level totalAttempts when the level exists', async () => {
    await Level.create({ levelNumber: 7, difficulty: 'medium', puzzle: '[]', solution: '[]' });
    const a = await reg('g_lvl');
    const r = await request(app).post('/api/games/start').set(auth(a.token)).send({ levelNumber: 7 });
    expect(r.status).toBe(201);
    const lvl = await Level.findOne({ levelNumber: 7 });
    expect(lvl.stats.totalAttempts).toBe(1);
  });

  test('save game progress → 200, unknown game → 404', async () => {
    const a = await reg('g_save');
    const gid = await startGame(a.token, 2);
    const ok = await request(app).post('/api/games/save').set(auth(a.token))
      .send({ gameId: gid, currentBoard: '[]', timeSpent: 5, errors: 0 });
    expect(ok.status).toBe(200);
    const ghost = new mongoose.Types.ObjectId().toString();
    const no = await request(app).post('/api/games/save').set(auth(a.token))
      .send({ gameId: ghost, currentBoard: '[]', timeSpent: 5, errors: 0 });
    expect(no.status).toBe(404);
  });

  test('game history → 200', async () => {
    const a = await reg('g_hist');
    await startGame(a.token, 1);
    const r = await request(app).get('/api/games/history').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.games)).toBe(true);
  });
});

// ============ SHOP ROUTES ============
describe('shop routes', () => {
  async function seedShop() {
    await ShopItem.create({
      itemId: 'theme_ocean', type: 'theme', name: { en: 'Ocean' },
      price: 200, discount: 0, isActive: true,
      themeData: { primary: '#06f' },
    });
    await ShopItem.create({
      itemId: 'pow_hint5', type: 'powerup', name: { en: 'Hints x5' },
      price: 50, discount: 0, isActive: true,
      powerupData: { effect: 'hint', quantity: 5 },
    });
    await ShopItem.create({
      itemId: 'theme_sale', type: 'theme', name: { en: 'On Sale' },
      price: 1000, discount: 90, isActive: true, // final price 100
      themeData: { primary: '#f00' },
    });
  }

  test('GET / lists active items', async () => {
    await seedShop();
    const r = await request(app).get('/api/shop');
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBe(3);
  });

  test('buy with insufficient coins → 400', async () => {
    await seedShop();
    const a = await reg('sh_poor'); // starts with 100 coins; theme is 200
    const r = await request(app).post('/api/shop/buy').set(auth(a.token)).send({ itemId: 'theme_ocean' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/enough/i);
  });

  test('valid powerup buy → 200 + balance decremented + powerup credited', async () => {
    await seedShop();
    const a = await reg('sh_pow'); // 100 coins; powerup is 50
    const before = await User.findById(a.id);
    const r = await request(app).post('/api/shop/buy').set(auth(a.token)).send({ itemId: 'pow_hint5' });
    expect(r.status).toBe(200);
    expect(r.body.balance).toBe(50);
    const after = await User.findById(a.id);
    expect(after.coins).toBe(before.coins - 50);
    expect(after.powerups.hint).toBe(before.powerups.hint + 5);
  });

  test('buy an already-owned theme → 400', async () => {
    // a cheap theme so the user can afford the first buy
    await ShopItem.create({
      itemId: 'theme_cheap', type: 'theme', name: { en: 'Cheap' },
      price: 10, discount: 0, isActive: true, themeData: { primary: '#0f0' },
    });
    const a = await reg('sh_dup');
    const first = await request(app).post('/api/shop/buy').set(auth(a.token)).send({ itemId: 'theme_cheap' });
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/shop/buy').set(auth(a.token)).send({ itemId: 'theme_cheap' });
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/owned/i);
  });

  test('buy a discounted theme uses the discounted price', async () => {
    await seedShop();
    const a = await reg('sh_sale'); // 100 coins; sale theme final = 1000*(1-0.9)=100
    const r = await request(app).post('/api/shop/buy').set(auth(a.token)).send({ itemId: 'theme_sale' });
    expect(r.status).toBe(200);
    // discounted price = 1000*(1-0.9) = 100; 100 starting coins → ~0 (float-safe)
    expect(r.body.balance).toBeCloseTo(0, 6);
    const after = await User.findById(a.id);
    expect(after.unlockedThemes).toContain('theme_sale');
  });

  test('buy an unknown itemId → 404', async () => {
    const a = await reg('sh_unknown');
    const r = await request(app).post('/api/shop/buy').set(auth(a.token)).send({ itemId: 'nope_nope' });
    expect(r.status).toBe(404);
  });
});

// ============ ACHIEVEMENTS ROUTES ============
describe('achievements routes', () => {
  test('GET / lists active achievements', async () => {
    await Achievement.create({ achievementId: 'a_list', icon: '⭐', requirement: { type: 'games_won', target: 1 }, rewards: { xp: 10, coins: 5 }, isActive: true });
    const r = await request(app).get('/api/achievements');
    expect(r.status).toBe(200);
    expect(r.body.achievements.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /me merges unlocked state', async () => {
    await Achievement.create({ achievementId: 'a_me', icon: '⭐', requirement: { type: 'games_won', target: 1 }, rewards: { xp: 10, coins: 5 }, isActive: true });
    const a = await reg('ach_me');
    const r = await request(app).get('/api/achievements/me').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.achievements[0].unlocked).toBe(false);
  });

  test('unlock with criteria met → 200 + rewards credited', async () => {
    await Achievement.create({ achievementId: 'win1', icon: '🏆', requirement: { type: 'games_won', target: 1 }, rewards: { xp: 200, coins: 100 }, isActive: true });
    const a = await reg('ach_win');
    // give the user the matching stat
    await User.findByIdAndUpdate(a.id, { $set: { 'stats.gamesWon': 5 } });
    const before = await User.findById(a.id);
    const r = await request(app).post('/api/achievements/win1/unlock').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.rewards.xp).toBe(200);
    const after = await User.findById(a.id);
    expect(after.xp).toBe(before.xp + 200);
    expect(after.coins).toBe(before.coins + 100);
    expect(after.achievements.some(x => x.achievementId === 'win1')).toBe(true);
  });

  test('unlock again → 400 already unlocked', async () => {
    await Achievement.create({ achievementId: 'win1b', icon: '🏆', requirement: { type: 'games_won', target: 1 }, rewards: { xp: 50, coins: 25 }, isActive: true });
    const a = await reg('ach_dup');
    await User.findByIdAndUpdate(a.id, { $set: { 'stats.gamesWon': 5 } });
    expect((await request(app).post('/api/achievements/win1b/unlock').set(auth(a.token))).status).toBe(200);
    const r = await request(app).post('/api/achievements/win1b/unlock').set(auth(a.token));
    expect(r.status).toBe(400);
  });

  test('unlock an unknown achievement id → 404', async () => {
    const a = await reg('ach_404');
    const r = await request(app).post('/api/achievements/no_such_ach/unlock').set(auth(a.token));
    expect(r.status).toBe(404);
  });

  test('unlock a no-requirement achievement → 200 unconditionally', async () => {
    // 'welcome' is auto-granted at registration, so use a distinct no-requirement id.
    await Achievement.create({ achievementId: 'firstlaunch', icon: '👋', rewards: { xp: 5, coins: 5 }, isActive: true });
    const a = await reg('ach_nofreq');
    const r = await request(app).post('/api/achievements/firstlaunch/unlock').set(auth(a.token));
    expect(r.status).toBe(200);
  });
});

// ============ DAILY / STATS / LEVELS ROUTES ============
describe('daily routes', () => {
  test('GET / generates/returns today challenge → 200', async () => {
    const a = await reg('dly_get');
    const r = await request(app).get('/api/daily').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.challenge).toBeTruthy();
    expect(r.body.completed).toBe(false);
  });

  test('POST /complete → 200 + streak + rewards, then repeat → 400', async () => {
    const { generateSudoku } = require('../src/utils/sudoku');
    const board = generateSudoku('easy').solution;   // a valid solved grid (anti-farm)
    const a = await reg('dly_done');
    const r = await request(app).post('/api/daily/complete').set(auth(a.token))
      .send({ board, timeSpent: 120, errors: 1, stars: 2 });
    expect(r.status).toBe(200);
    expect(r.body.streak).toBe(1);
    expect(r.body.rewards.xp).toBeGreaterThan(0);
    const again = await request(app).post('/api/daily/complete').set(auth(a.token))
      .send({ board, timeSpent: 60, errors: 0, stars: 3 });
    expect(again.status).toBe(400);   // already completed today
  });

  test('GET / after completing reflects completed:true', async () => {
    const { generateSudoku } = require('../src/utils/sudoku');
    const a = await reg('dly_state');
    await request(app).post('/api/daily/complete').set(auth(a.token)).send({ board: generateSudoku('easy').solution, timeSpent: 30, errors: 0, stars: 3 });
    const r = await request(app).get('/api/daily').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.completed).toBe(true);
  });
});

describe('stats routes', () => {
  test('GET / global stats → 200', async () => {
    await reg('st_seed'); // at least one user so topPlayer resolves
    const r = await request(app).get('/api/stats');
    expect(r.status).toBe(200);
    expect(r.body.stats).toBeTruthy();
    expect(typeof r.body.stats.totalUsers).toBe('number');
  });

  test('GET /me user stats → 200', async () => {
    const a = await reg('st_me');
    const r = await request(app).get('/api/stats/me').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.stats).toBeTruthy();
    expect(Array.isArray(r.body.recentGames)).toBe(true);
  });
});

describe('levels routes', () => {
  test('GET / lists levels with progress → 200', async () => {
    await Level.create({ levelNumber: 1, difficulty: 'easy', puzzle: '[]', solution: '[]', isActive: true });
    await Level.create({ levelNumber: 2, difficulty: 'medium', puzzle: '[]', solution: '[]', isActive: true });
    const a = await reg('lv_list');
    const r = await request(app).get('/api/levels').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.levels.length).toBe(2);
    expect(r.body.levels[0]).toHaveProperty('locked');
  });

  test('GET /:id existing level → 200', async () => {
    await Level.create({ levelNumber: 9, difficulty: 'hard', puzzle: '[]', solution: '[]', isActive: true });
    const a = await reg('lv_one');
    const r = await request(app).get('/api/levels/9').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.level.levelNumber).toBe(9);
  });

  test('GET /:id unknown level → 404', async () => {
    const a = await reg('lv_404');
    const r = await request(app).get('/api/levels/9999').set(auth(a.token));
    expect(r.status).toBe(404);
  });
});

// ============ TURN CREDS ROUTE ============
describe('turn route', () => {
  test('GET /api/turn-creds returns STUN-only when no secret', async () => {
    const prev = process.env.TURN_SHARED_SECRET;
    delete process.env.TURN_SHARED_SECRET;
    const r = await request(app).get('/api/turn-creds');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.iceServers)).toBe(true);
    expect(r.body.iceServers.every(s => String(s.urls).startsWith('stun:'))).toBe(true);
    if (prev !== undefined) process.env.TURN_SHARED_SECRET = prev;
  });

  test('GET /api/turn-creds derives the username from the AUTH TOKEN, not a spoofable header', async () => {
    const prev = process.env.TURN_SHARED_SECRET;
    process.env.TURN_SHARED_SECRET = 'test-turn-secret';
    const u = await reg('turnuser');

    // A spoofed x-user-id must be ignored (was a credential-attribution spoof).
    const spoof = await request(app).get('/api/turn-creds').set('x-user-id', 'player42');
    expect(spoof.status).toBe(200);
    const spoofTurn = spoof.body.iceServers.find(s => String(s.urls).startsWith('turn:'));
    expect(spoofTurn.username).not.toMatch(/:player42$/);   // header no longer trusted

    // A valid token → username is bound to the authenticated user id.
    const authed = await request(app).get('/api/turn-creds').set('Authorization', `Bearer ${u.token}`);
    const authedTurn = authed.body.iceServers.find(s => String(s.urls).startsWith('turn:'));
    expect(authedTurn).toBeTruthy();
    expect(authedTurn.username).toMatch(new RegExp(`:${u.id}$`));
    expect(authedTurn.credential).toBeTruthy();
    expect(authed.body.ttlSec).toBe(3600);                  // tightened from 6h to 1h
    if (prev === undefined) delete process.env.TURN_SHARED_SECRET;
    else process.env.TURN_SHARED_SECRET = prev;
  });
});

// ============ YOUTUBE ROUTE (reachability) ============
describe('youtube route', () => {
  test('GET /api/youtube/auth-url with a token is reachable (not 404)', async () => {
    const a = await reg('yt_auth');
    const r = await request(app).get('/api/youtube/auth-url').set(auth(a.token));
    // configured (200 with url) OR not configured (503) — never 404, never 401
    expect([200, 503]).toContain(r.status);
    expect(r.status).not.toBe(404);
    if (r.status === 200) expect(r.body.url).toBeTruthy();
  });

  test('GET /api/youtube/auth-url without a token → 401', async () => {
    const r = await request(app).get('/api/youtube/auth-url');
    expect(r.status).toBe(401);
  });

  test('GET /api/youtube/status with a token → 200', async () => {
    const a = await reg('yt_status');
    const r = await request(app).get('/api/youtube/status').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('connected');
  });
});
