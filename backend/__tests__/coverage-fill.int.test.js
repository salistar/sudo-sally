process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest-int';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.GOOGLE_ALLOWED_AUDS = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_REDIRECT_URI = 'https://api.sallysudo.com/api/youtube/callback';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/index');
const User = require('../src/models/User');
const Challenge = require('../src/models/Challenge');

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

// The auth middleware itself calls User.findById(decoded.id) before the route
// handler runs. To force ONLY a handler's findById to throw (and let auth pass),
// spy with a passthrough for the first call(s) and throw on a later one.
// `throwOnCall` is 1-based: which invocation should blow up.
function throwOnNthFindById(throwOnCall, err = new Error('boom')) {
  const real = User.findById.bind(User);
  let n = 0;
  return jest.spyOn(User, 'findById').mockImplementation((...args) => {
    n += 1;
    if (n === throwOnCall) throw err;
    return real(...args);
  });
}

// ============================================================================
// routes/users.js — search / recent / by-username / update / delete /
//                    settings / block / unblock / blocked
// ============================================================================
describe('Users routes coverage', () => {
  test('GET /users/search: <2 chars → empty short-circuit', async () => {
    const a = await reg('srch');
    const r = await request(app).get('/api/users/search?q=a').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.users).toEqual([]);
  });
  test('GET /users/search: missing q → empty', async () => {
    const a = await reg('srch');
    const r = await request(app).get('/api/users/search').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.users).toEqual([]);
  });
  test('GET /users/search: ≥2 chars → matches by prefix, excludes self, escapes regex', async () => {
    const a = await reg('seeker');
    // Two findable targets that share a prefix; plus a non-match.
    const t1 = await reg('Zeta');
    const t2 = await reg('Zephyr');
    await reg('Omega');
    const r = await request(app).get('/api/users/search?q=ze').set(auth(a.token));
    expect(r.status).toBe(200);
    const names = r.body.users.map((u) => u.username);
    expect(names).toEqual(expect.arrayContaining([t1.username, t2.username]));
    expect(names).not.toContain(a.username);          // self excluded
    expect(names.some((n) => /^Omega/i.test(n))).toBe(false);
    // regex metachars in input must not blow up / must be escaped
    const r2 = await request(app).get('/api/users/search?q=' + encodeURIComponent('.*')).set(auth(a.token));
    expect(r2.status).toBe(200);
    expect(Array.isArray(r2.body.users)).toBe(true);
  });

  test('GET /users/recent: returns recently-active others, never self', async () => {
    const a = await reg('recme');
    const other = await reg('recother');
    // make the "other" clearly recent / online
    await User.findByIdAndUpdate(other.id, { isOnline: true, lastActive: new Date(), lastLogin: new Date() });
    const r = await request(app).get('/api/users/recent').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.users)).toBe(true);
    const ids = r.body.users.map((u) => String(u._id));
    expect(ids).toContain(String(other.id));
    expect(ids).not.toContain(String(a.id));          // self filtered out
  });

  test('GET /users/by-username/:username: found (public fields only) + recentMatches', async () => {
    const a = await reg('pubby');
    const r = await request(app).get('/api/users/by-username/' + a.username.toUpperCase()); // case-insensitive
    expect(r.status).toBe(200);
    expect(r.body.user.username).toBe(a.username);
    expect(r.body.user.email).toBeUndefined();
    expect(Array.isArray(r.body.user.recentMatches)).toBe(true);
  });
  test('GET /users/by-username/:username: 404 when unknown', async () => {
    const r = await request(app).get('/api/users/by-username/nobody_here_xyz');
    expect(r.status).toBe(404);
  });

  test('PUT /users/:id: self-update succeeds, forbidden fields (role/coins/stars) stripped', async () => {
    const a = await reg('upd');
    const r = await request(app).put('/api/users/' + a.id).set(auth(a.token)).send({
      avatar: '🦊',
      role: 'admin',     // must be stripped
      coins: 999999,     // must be stripped
      stars: 5000,       // must be stripped
    });
    expect(r.status).toBe(200);
    expect(r.body.user.avatar).toBe('🦊');
    expect(r.body.user.role).toBe('user');         // not escalated
    expect(r.body.user.coins).not.toBe(999999);    // not inflated
    expect(r.body.user.stars).not.toBe(5000);
    // verify persisted in DB too
    const fresh = await User.findById(a.id);
    expect(fresh.role).toBe('user');
    expect(fresh.coins).not.toBe(999999);
  });
  test('PUT /users/:id: by a non-owner → 403', async () => {
    const a = await reg('upo_a'); const b = await reg('upo_b');
    const r = await request(app).put('/api/users/' + b.id).set(auth(a.token)).send({ avatar: '😈' });
    expect(r.status).toBe(403);
  });

  test('DELETE /users/:id: by a non-owner → 403', async () => {
    const a = await reg('del_a'); const b = await reg('del_b');
    const r = await request(app).delete('/api/users/' + b.id).set(auth(a.token));
    expect(r.status).toBe(403);
  });
  test('DELETE /users/:id: self → 200 and the account is gone', async () => {
    const a = await reg('del_self');
    const r = await request(app).delete('/api/users/' + a.id).set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(await User.findById(a.id)).toBeNull();
  });

  test('PUT /users/:id/settings: self success path merges settings', async () => {
    const a = await reg('setok');
    const r = await request(app).put('/api/users/' + a.id + '/settings').set(auth(a.token)).send({ language: 'ar', sound: false });
    expect(r.status).toBe(200);
    expect(r.body.settings.language).toBe('ar');
    expect(r.body.settings.sound).toBe(false);
    expect(r.body.settings.music).toBe(true);     // untouched defaults preserved
  });

  test('GET /users/by-username/:username: recentMatches reflects a completed duel (win)', async () => {
    const a = await reg('rmwin'); const b = await reg('rmwin_opp');
    // Seed a completed challenge where `a` is the challenger AND the winner.
    await Challenge.create({
      challenger: a.id,
      challenged: b.id,
      puzzle: '0'.repeat(81),
      solution: '1'.repeat(81),
      difficulty: 'easy',
      status: 'completed',
      winner: a.id,
      loser: b.id,
      isDraw: false,
      challengerProgress: { timeSpent: 88, errors: 1 },
      challengedProgress: { timeSpent: 120, errors: 4 },
      completedAt: new Date(),
    });
    const r = await request(app).get('/api/users/by-username/' + a.username);
    expect(r.status).toBe(200);
    const matches = r.body.user.recentMatches;
    expect(matches.length).toBe(1);
    expect(matches[0].outcome).toBe('win');
    expect(matches[0].opponent).toBe(b.username);
    expect(matches[0].timeSpent).toBe(88);
    expect(matches[0].errors).toBe(1);
    // body/solution never leak in the public match summary
    expect(JSON.stringify(matches)).not.toContain('solution');
  });

  test('GET /users (list all) succeeds for an admin', async () => {
    const a = await reg('adm');
    await User.findByIdAndUpdate(a.id, { role: 'admin' });
    const r = await request(app).get('/api/users').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(typeof r.body.count).toBe('number');
    // no password field leaks
    expect(JSON.stringify(r.body.users)).not.toContain('"password"');
  });

  test('GET /users/:id self → full profile (owner sees -password projection)', async () => {
    const a = await reg('selfget');
    const r = await request(app).get('/api/users/' + a.id).set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.user.username).toBe(a.username);
    expect(r.body.user.password).toBeUndefined();
  });

  test('block / unblock / GET me/blocked (populated)', async () => {
    const a = await reg('blkc_a'); const b = await reg('blkc_b');
    expect((await request(app).post('/api/users/' + b.id + '/block').set(auth(a.token))).status).toBe(200);
    // blocked list is populated with username/avatar
    const listed = await request(app).get('/api/users/me/blocked').set(auth(a.token));
    expect(listed.status).toBe(200);
    expect(listed.body.blocked.length).toBe(1);
    expect(listed.body.blocked[0].username).toBe(b.username);
    // unblock removes it
    expect((await request(app).post('/api/users/' + b.id + '/unblock').set(auth(a.token))).status).toBe(200);
    const after = await request(app).get('/api/users/me/blocked').set(auth(a.token));
    expect(after.body.blocked.length).toBe(0);
  });
});

// ============================================================================
// Error/500 paths (catch blocks) — force the underlying model call to throw,
// then restore. This is test-only stubbing; src/ is untouched.
// ============================================================================
describe('Users routes — 500 catch paths', () => {
  afterEach(() => jest.restoreAllMocks());

  test('GET /users/search → 500 when the query throws', async () => {
    const a = await reg('e_srch');
    jest.spyOn(User, 'find').mockImplementationOnce(() => { throw new Error('boom-find'); });
    const r = await request(app).get('/api/users/search?q=ab').set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('GET /users/recent → 500 when the query throws', async () => {
    const a = await reg('e_rec');
    jest.spyOn(User, 'find').mockImplementationOnce(() => { throw new Error('boom-recent'); });
    const r = await request(app).get('/api/users/recent').set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('GET /users/by-username → 500 when the lookup throws', async () => {
    await reg('e_by');
    jest.spyOn(User, 'findOne').mockImplementationOnce(() => { throw new Error('boom-by'); });
    const r = await request(app).get('/api/users/by-username/whoever');
    expect(r.status).toBe(500);
  });
  test('GET /users (admin) → 500 when the query throws', async () => {
    const a = await reg('e_all');
    await User.findByIdAndUpdate(a.id, { role: 'admin' });
    jest.spyOn(User, 'find').mockImplementationOnce(() => { throw new Error('boom-all'); });
    const r = await request(app).get('/api/users').set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('GET /users/:id → 500 when findById throws', async () => {
    const a = await reg('e_one');
    throwOnNthFindById(2, new Error('boom-one'));   // #1 = auth, #2 = handler
    const r = await request(app).get('/api/users/' + a.id).set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('PUT /users/:id → 500 when the update throws', async () => {
    const a = await reg('e_upd');
    jest.spyOn(User, 'findByIdAndUpdate').mockImplementationOnce(() => { throw new Error('boom-upd'); });
    const r = await request(app).put('/api/users/' + a.id).set(auth(a.token)).send({ avatar: 'x' });
    expect(r.status).toBe(500);
  });
  test('DELETE /users/:id → 500 when the delete throws', async () => {
    const a = await reg('e_del');
    jest.spyOn(User, 'findByIdAndDelete').mockImplementationOnce(() => { throw new Error('boom-del'); });
    const r = await request(app).delete('/api/users/' + a.id).set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('PUT /users/:id/settings → 500 when findById throws', async () => {
    const a = await reg('e_set');
    throwOnNthFindById(2, new Error('boom-set'));   // #1 = auth, #2 = handler
    const r = await request(app).put('/api/users/' + a.id + '/settings').set(auth(a.token)).send({ language: 'ar' });
    expect(r.status).toBe(500);
  });
  test('POST /users/:id/block → 500 when the update throws', async () => {
    const a = await reg('e_blk_a'); const b = await reg('e_blk_b');
    jest.spyOn(User, 'findByIdAndUpdate').mockImplementationOnce(() => { throw new Error('boom-blk'); });
    const r = await request(app).post('/api/users/' + b.id + '/block').set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('POST /users/:id/unblock → 500 when the update throws', async () => {
    const a = await reg('e_unb_a'); const b = await reg('e_unb_b');
    jest.spyOn(User, 'findByIdAndUpdate').mockImplementationOnce(() => { throw new Error('boom-unb'); });
    const r = await request(app).post('/api/users/' + b.id + '/unblock').set(auth(a.token));
    expect(r.status).toBe(500);
  });
  test('GET /users/me/blocked → 500 when the lookup throws', async () => {
    const a = await reg('e_mbl');
    throwOnNthFindById(2, new Error('boom-mbl'));   // #1 = auth, #2 = handler
    const r = await request(app).get('/api/users/me/blocked').set(auth(a.token));
    expect(r.status).toBe(500);
  });
});

// ============================================================================
// controllers/leaderboardController.js — global / weekly / me
// ============================================================================
describe('Leaderboard coverage', () => {
  async function seedThree() {
    const a = await reg('lbA'); const b = await reg('lbB'); const c = await reg('lbC');
    await User.findByIdAndUpdate(a.id, { stars: 300, 'stats.gamesWon': 30 });
    await User.findByIdAndUpdate(b.id, { stars: 200, 'stats.gamesWon': 20 });
    await User.findByIdAndUpdate(c.id, { stars: 100, 'stats.gamesWon': 10 });
    return { a, b, c };
  }
  test('GET /leaderboard: ranked desc by stars with rank field', async () => {
    const { a, b, c } = await seedThree();
    const r = await request(app).get('/api/leaderboard');
    expect(r.status).toBe(200);
    const lb = r.body.leaderboard;
    expect(lb.length).toBeGreaterThanOrEqual(3);
    expect(lb[0].rank).toBe(1);
    expect(lb[1].rank).toBe(2);
    // descending stars
    expect(lb[0].stars).toBeGreaterThanOrEqual(lb[1].stars);
    expect(String(lb[0].userId)).toBe(String(a.id));
    expect(lb[0].gamesWon).toBe(30);
    expect(String(lb[2].userId)).toBe(String(c.id));
    expect(b).toBeTruthy();
  });
  test('GET /leaderboard?limit=2 honors the limit', async () => {
    await seedThree();
    const r = await request(app).get('/api/leaderboard?limit=2');
    expect(r.status).toBe(200);
    expect(r.body.leaderboard.length).toBe(2);
  });
  test('GET /leaderboard/me: rank = count above + 1', async () => {
    const { b } = await seedThree();   // b has 200 stars → one user above (a=300)
    const me = await request(app).get('/api/leaderboard/me').set(auth(b.token));
    expect(me.status).toBe(200);
    expect(me.body.rank).toBe(2);
    expect(me.body.stars).toBe(200);
    expect(me.body.gamesWon).toBe(20);
  });
  test('GET /leaderboard/weekly: 200 with period key (empty entries ok)', async () => {
    await seedThree();
    const r = await request(app).get('/api/leaderboard/weekly');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(typeof r.body.period).toBe('string');
    expect(Array.isArray(r.body.leaderboard)).toBe(true);
  });

  // ── 500 catch paths ──
  test('GET /leaderboard → 500 when User.find throws', async () => {
    jest.spyOn(User, 'find').mockImplementationOnce(() => { throw new Error('boom-lb'); });
    const r = await request(app).get('/api/leaderboard');
    expect(r.status).toBe(500);
    jest.restoreAllMocks();
  });
  test('GET /leaderboard/weekly → 500 when LeaderboardEntry.find throws', async () => {
    const LeaderboardEntry = require('../src/models/Leaderboard');
    jest.spyOn(LeaderboardEntry, 'find').mockImplementationOnce(() => { throw new Error('boom-wk'); });
    const r = await request(app).get('/api/leaderboard/weekly');
    expect(r.status).toBe(500);
    jest.restoreAllMocks();
  });
  test('GET /leaderboard/me → 500 when User.findById throws', async () => {
    const a = await reg('lberr');
    throwOnNthFindById(2, new Error('boom-me'));    // #1 = auth, #2 = controller
    const r = await request(app).get('/api/leaderboard/me').set(auth(a.token));
    expect(r.status).toBe(500);
    jest.restoreAllMocks();
  });
});

// ============================================================================
// routes/youtube.js + services/youtubeService.js — mock global.fetch (Google)
// ============================================================================
describe('YouTube control-plane coverage (mocked Google)', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  // Helper: route Google OAuth/API calls based on the requested URL.
  function mockGoogle({ tokenResponse, tokenOk = true, channelResponse } = {}) {
    global.fetch = jest.fn(async (input) => {
      const url = (typeof input === 'string' ? input : input.toString());
      if (url.includes('oauth2.googleapis.com/token')) {
        return { ok: tokenOk, status: tokenOk ? 200 : 400, json: async () => tokenResponse };
      }
      if (url.includes('googleapis.com/youtube/v3/channels')) {
        return { ok: true, status: 200, json: async () => (channelResponse || { items: [{ id: 'UC_chan', snippet: { title: 'My Channel' } }] }) };
      }
      // default: any other YT call
      return { ok: true, status: 200, json: async () => ({}) };
    });
  }

  test('GET /auth-url: returns a consent URL containing client_id + state', async () => {
    const a = await reg('ytauth');
    const r = await request(app).get('/api/youtube/auth-url').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.url).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(r.body.url).toContain('client_id=test-client');
    expect(r.body.url).toContain('state=');
    // the embedded state must be a valid JWT bound to this user
    const u = new URL(r.body.url);
    const decoded = jwt.verify(u.searchParams.get('state'), process.env.JWT_SECRET);
    expect(decoded.uid).toBe(String(a.id));
    expect(decoded.platform).toBe('web');
  });

  test('GET /auth-url?platform=mobile: state encodes mobile platform', async () => {
    const a = await reg('ytauthm');
    const r = await request(app).get('/api/youtube/auth-url?platform=mobile').set(auth(a.token));
    expect(r.status).toBe(200);
    const u = new URL(r.body.url);
    const decoded = jwt.verify(u.searchParams.get('state'), process.env.JWT_SECRET);
    expect(decoded.platform).toBe('mobile');
  });

  test('GET /status: connected:false before any connect', async () => {
    const a = await reg('ytst');
    const r = await request(app).get('/api/youtube/status').set(auth(a.token));
    expect(r.status).toBe(200);
    expect(r.body.configured).toBe(true);
    expect(r.body.connected).toBe(false);
    expect(r.body.channelTitle).toBeNull();
  });

  test('GET /callback (web): exchanges code → stores ENCRYPTED refresh token → redirect; status becomes connected', async () => {
    const a = await reg('ytcb');
    // craft a valid state for this user (web)
    const state = jwt.sign({ uid: String(a.id), platform: 'web' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    mockGoogle({
      tokenResponse: { access_token: 'acc-123', refresh_token: 'refresh-xyz', scope: 'https://www.googleapis.com/auth/youtube.force-ssl', expires_in: 3600, token_type: 'Bearer' },
    });
    const r = await request(app).get('/api/youtube/callback').query({ code: 'auth-code-1', state });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('youtube=connected');

    // refresh token persisted ENCRYPTED (never plaintext), connected=true, channel captured
    const stored = await User.findById(a.id).select('+youtube.refreshToken');
    expect(stored.youtube.connected).toBe(true);
    expect(stored.youtube.channelTitle).toBe('My Channel');
    expect(stored.youtube.channelId).toBe('UC_chan');
    expect(stored.youtube.refreshToken).toBeTruthy();
    expect(stored.youtube.refreshToken).not.toBe('refresh-xyz');   // encrypted at rest
    expect(stored.youtube.refreshToken).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/); // iv:tag:data

    // and /status now reports connected:true
    const st = await request(app).get('/api/youtube/status').set(auth(a.token));
    expect(st.body.connected).toBe(true);
    expect(st.body.channelTitle).toBe('My Channel');
  });

  test('GET /callback (mobile): redirects to the app deep link', async () => {
    const a = await reg('ytcbm');
    const state = jwt.sign({ uid: String(a.id), platform: 'mobile' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    mockGoogle({ tokenResponse: { access_token: 'acc', refresh_token: 'rt', scope: 's', token_type: 'Bearer' } });
    const r = await request(app).get('/api/youtube/callback').query({ code: 'c', state });
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain('sudokusallyv3://youtube?connected=1');
  });

  test('GET /callback: missing code/state → 400', async () => {
    const r = await request(app).get('/api/youtube/callback').query({ state: 'x' });
    expect(r.status).toBe(400);
    expect(r.text).toContain('Missing code/state');
  });
  test('GET /callback: Google returned ?error → 400, raw value NOT reflected (XSS-safe)', async () => {
    // SEC-1 fix: the public callback must NOT reflect attacker-controlled query
    // back into the HTML. A script payload must be neither executed nor echoed raw.
    const r = await request(app).get('/api/youtube/callback').query({ error: '<script>alert(1)</script>' });
    expect(r.status).toBe(400);
    expect(r.text).not.toContain('<script>alert(1)</script>');   // not reflected
    expect(r.text).toContain('Authorization was denied');         // generic message
  });
  test('GET /callback: invalid/expired state → 400', async () => {
    const r = await request(app).get('/api/youtube/callback').query({ code: 'c', state: 'not-a-jwt' });
    expect(r.status).toBe(400);
    expect(r.text).toContain('Invalid or expired state');
  });
  test('GET /callback: token exchange failure surfaces an error', async () => {
    const a = await reg('ytcbfail');
    const state = jwt.sign({ uid: String(a.id), platform: 'web' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    mockGoogle({ tokenOk: false, tokenResponse: { error: 'invalid_grant', error_description: 'bad code' } });
    const r = await request(app).get('/api/youtube/callback').query({ code: 'bad', state });
    expect(r.status).toBe(400);
    expect(r.text).toContain('token exchange failed');
  });

  test('POST /live/create: exchanges refresh→access then creates broadcast+stream (drives ytFetch + createLiveBroadcast)', async () => {
    const a = await reg('ytlc');
    // First connect so a refresh token is stored.
    const state = jwt.sign({ uid: String(a.id), platform: 'web' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    mockGoogle({ tokenResponse: { access_token: 'acc', refresh_token: 'rt', scope: 's', token_type: 'Bearer' } });
    await request(app).get('/api/youtube/callback').query({ code: 'c', state });

    // Now mock the live/create chain: token refresh + 3 YT API calls.
    global.fetch = jest.fn(async (input) => {
      const url = (typeof input === 'string' ? input : input.toString());
      if (url.includes('oauth2.googleapis.com/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'fresh-access' }) };
      }
      if (url.includes('/liveBroadcasts/bind')) {
        return { ok: true, status: 200, json: async () => ({ id: 'bcast-1' }) };
      }
      if (url.includes('/liveBroadcasts')) {
        return { ok: true, status: 200, json: async () => ({ id: 'bcast-1' }) };
      }
      if (url.includes('/liveStreams')) {
        return { ok: true, status: 200, json: async () => ({ id: 'stream-1', cdn: { ingestionInfo: { ingestionAddress: 'rtmp://a.rtmp.youtube.com/live2', streamName: 'key-123' } } }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const r = await request(app).post('/api/youtube/live/create').set(auth(a.token)).send({ title: 'Duel', privacy: 'unlisted' });
    expect(r.status).toBe(200);
    expect(r.body.broadcastId).toBe('bcast-1');
    expect(r.body.streamId).toBe('stream-1');
    expect(r.body.ingestionAddress).toContain('rtmp://');
    expect(r.body.streamName).toBe('key-123');
    expect(r.body.watchUrl).toContain('youtube.com/watch?v=bcast-1');
  });

  test('POST /live/transition: drives transitionBroadcast via the route', async () => {
    const a = await reg('ytlt');
    const state = jwt.sign({ uid: String(a.id), platform: 'web' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    mockGoogle({ tokenResponse: { access_token: 'acc', refresh_token: 'rt', scope: 's', token_type: 'Bearer' } });
    await request(app).get('/api/youtube/callback').query({ code: 'c', state });

    global.fetch = jest.fn(async (input) => {
      const url = (typeof input === 'string' ? input : input.toString());
      if (url.includes('oauth2.googleapis.com/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'fresh' }) };
      }
      if (url.includes('/liveBroadcasts/transition')) {
        return { ok: true, status: 200, json: async () => ({ id: 'bcast-1', status: { lifeCycleStatus: 'live' } }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const r = await request(app).post('/api/youtube/live/transition').set(auth(a.token)).send({ broadcastId: 'bcast-1', status: 'live' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });

  test('POST /live/transition: invalid status → 400', async () => {
    const a = await reg('ytlt2');
    const r = await request(app).post('/api/youtube/live/transition').set(auth(a.token)).send({ broadcastId: 'b', status: 'nope' });
    expect(r.status).toBe(400);
  });

  test('POST /live/create: not connected → 400 (refresh missing)', async () => {
    const a = await reg('ytnc');
    const r = await request(app).post('/api/youtube/live/create').set(auth(a.token)).send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/not connected/i);
  });

  test('POST /disconnect: clears the connection', async () => {
    const a = await reg('ytdc');
    const state = jwt.sign({ uid: String(a.id), platform: 'web' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    mockGoogle({ tokenResponse: { access_token: 'acc', refresh_token: 'rt', scope: 's', token_type: 'Bearer' } });
    await request(app).get('/api/youtube/callback').query({ code: 'c', state });
    const r = await request(app).post('/api/youtube/disconnect').set(auth(a.token));
    expect(r.status).toBe(200);
    const st = await request(app).get('/api/youtube/status').set(auth(a.token));
    expect(st.body.connected).toBe(false);
  });
});
