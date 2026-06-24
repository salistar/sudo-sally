/**
 * Tests for utils/storage.ts.
 *
 * storage.ts imports @react-native-async-storage/async-storage (a native
 * module that can't run in node) and ./i18n. We replace AsyncStorage with a
 * tiny in-memory implementation so the AsyncStorage-backed CRUD runs in node,
 * and we mock global.fetch so the network-touching login/guest paths are
 * deterministic.
 */

// ── In-memory AsyncStorage mock ────────────────────────────────────────────
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (mockStore.has(k) ? mockStore.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
    clear: jest.fn(async () => { mockStore.clear(); }),
    multiRemove: jest.fn(async (keys: string[]) => { keys.forEach(k => mockStore.delete(k)); }),
    getAllKeys: jest.fn(async () => [...mockStore.keys()]),
  },
}));

// storage.ts reads the React-Native global __DEV__ at module load time (for
// the DEV-only TEST_USERS list). It is undefined in the node test env, so we
// define it BEFORE requiring the module. A require() (not a hoisted import)
// guarantees the assignment runs first.
(globalThis as any).__DEV__ = true;
import type { User, LevelData } from '../storage';
const {
  storage,
  formatTime,
  calculateStars,
  calculateXP,
  generateLevels,
  ACHIEVEMENTS,
  LEADERBOARD,
  TEST_USERS,
} = require('../storage');

// Pristine snapshot taken at load time. storage mutates the shared
// module-level ACHIEVEMENTS array in place (getAchievements() hands out that
// reference when nothing is persisted), so tests that call updateAchievement /
// checkAchievements would otherwise permanently corrupt the constant for every
// later test. We clone from THIS snapshot — captured before any test runs — and
// re-seed storage before each test so nothing ever touches the live constant.
const PRISTINE_ACHIEVEMENTS = JSON.parse(JSON.stringify(ACHIEVEMENTS));

beforeEach(() => {
  mockStore.clear();
  jest.restoreAllMocks();
  // Seed a fresh copy so getAchievements()/updateAchievement()/checkAchievements()
  // operate on the clone, never on the shared module constant.
  mockStore.set('sudoku_achievements', JSON.stringify(PRISTINE_ACHIEVEMENTS));
});

const mkUser = (over: Partial<User> = {}): User => ({
  id: 'u1',
  username: 'Tester',
  email: 't@t.com',
  avatar: '🎮',
  level: 1,
  xp: 0,
  coins: 100,
  stars: 0,
  createdAt: new Date().toISOString(),
  ...over,
});

// ============ PURE HELPERS ============

describe('formatTime', () => {
  test('pads minutes and seconds to 2 digits', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(600)).toBe('10:00');
    expect(formatTime(3599)).toBe('59:59');
  });
});

describe('calculateStars', () => {
  test('3+ errors always returns 1 star (even with a fast time)', () => {
    expect(calculateStars(10, 'beginner', 3)).toBe(1);
    expect(calculateStars(10, 'beginner', 5)).toBe(1);
  });
  test('fast (≤50% base) with 0 errors returns 3 stars', () => {
    // beginner base = 180, half = 90
    expect(calculateStars(80, 'beginner', 0)).toBe(3);
    expect(calculateStars(90, 'beginner', 0)).toBe(3);
  });
  test('half-time but with an error does NOT give 3 stars', () => {
    // 80 <= 90 but errors=1 → falls through to the ≤base/≤1err branch → 2
    expect(calculateStars(80, 'beginner', 1)).toBe(2);
  });
  test('within base time and ≤1 error returns 2 stars', () => {
    expect(calculateStars(150, 'beginner', 0)).toBe(2); // >half, <=base
    expect(calculateStars(180, 'beginner', 1)).toBe(2);
  });
  test('slow or 2 errors returns 1 star', () => {
    expect(calculateStars(500, 'beginner', 0)).toBe(1); // over base
    expect(calculateStars(150, 'beginner', 2)).toBe(1); // 2 errors, within base
  });
  test('unknown difficulty falls back to base 300', () => {
    expect(calculateStars(140, 'nonsense', 0)).toBe(3); // <=150 half
    expect(calculateStars(300, 'nonsense', 1)).toBe(2); // <=300 base
    expect(calculateStars(301, 'nonsense', 0)).toBe(1); // over base
  });
  test('per-difficulty base times', () => {
    expect(calculateStars(600, 'master', 0)).toBe(3); // master base 1200, half 600
    expect(calculateStars(450, 'expert', 0)).toBe(3); // expert base 900, half 450
  });
});

describe('calculateXP', () => {
  test('applies per-difficulty multipliers, rounded', () => {
    expect(calculateXP(3, 'beginner')).toBe(30); // 3*10*1
    expect(calculateXP(3, 'easy')).toBe(45); // 3*10*1.5
    expect(calculateXP(3, 'medium')).toBe(60); // *2
    expect(calculateXP(2, 'hard')).toBe(60); // 2*10*3
    expect(calculateXP(1, 'expert')).toBe(40); // *4
    expect(calculateXP(1, 'master')).toBe(50); // *5
  });
  test('unknown difficulty uses multiplier 1', () => {
    expect(calculateXP(2, 'zzz')).toBe(20);
  });
  test('zero stars yields zero xp', () => {
    expect(calculateXP(0, 'master')).toBe(0);
  });
});

// ============ STATIC DATA ============

describe('generateLevels', () => {
  test('produces 30 levels with correct difficulty bands + lock state', () => {
    const lv = generateLevels();
    expect(lv).toHaveLength(30);
    expect(lv[0]).toMatchObject({ id: 1, difficulty: 'beginner', locked: false });
    expect(lv[4].difficulty).toBe('beginner');
    expect(lv[5].difficulty).toBe('easy'); // level 6
    expect(lv[10].difficulty).toBe('medium'); // level 11
    expect(lv[15].difficulty).toBe('hard'); // level 16
    expect(lv[20].difficulty).toBe('expert'); // level 21
    expect(lv[25].difficulty).toBe('master'); // level 26
    expect(lv[29].id).toBe(30);
    // all but level 1 are locked
    expect(lv.filter(l => l.locked)).toHaveLength(29);
    lv.forEach(l => {
      expect(l.stars).toBe(0);
      expect(l.bestTime).toBeNull();
      expect(l.completed).toBe(false);
      expect(l.hintsUsed).toBe(0);
    });
  });
});

describe('static data integrity', () => {
  test('ACHIEVEMENTS each have id/title{en,fr,ar}/target', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThan(0);
    ACHIEVEMENTS.forEach(a => {
      expect(typeof a.id).toBe('string');
      expect(a.title.en && a.title.fr && a.title.ar).toBeTruthy();
      expect(a.description.en && a.description.fr && a.description.ar).toBeTruthy();
      expect(a.target).toBeGreaterThan(0);
      expect(typeof a.icon).toBe('string');
    });
    // ids are unique
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('welcome achievement is pre-unlocked', () => {
    const welcome = ACHIEVEMENTS.find(a => a.id === 'welcome');
    expect(welcome?.unlocked).toBe(true);
  });
  test('LEADERBOARD has 10 ranked entries', () => {
    expect(LEADERBOARD).toHaveLength(10);
    LEADERBOARD.forEach((e, i) => {
      expect(e.rank).toBe(i + 1);
      expect(typeof e.username).toBe('string');
      expect(typeof e.stars).toBe('number');
    });
  });
  test('TEST_USERS available in DEV (jest sets __DEV__ true)', () => {
    expect(Array.isArray(TEST_USERS)).toBe(true);
  });
});

// ============ ASYNCSTORAGE-BACKED CRUD ============

describe('user persistence', () => {
  test('getUser returns null when nothing stored', async () => {
    expect(await storage.getUser()).toBeNull();
  });
  test('setUser then getUser round-trips', async () => {
    const u = mkUser({ username: 'Alice' });
    await storage.setUser(u);
    expect(await storage.getUser()).toEqual(u);
  });
  test('clearUser removes user + auth token', async () => {
    await storage.setUser(mkUser());
    mockStore.set('sudoku_auth_token', 'tok');
    await storage.clearUser();
    expect(await storage.getUser()).toBeNull();
    expect(await storage.isLoggedIn()).toBe(false);
  });
});

describe('levels persistence', () => {
  test('getLevels falls back to generated levels when empty', async () => {
    const lv = await storage.getLevels();
    expect(lv).toHaveLength(30);
  });
  test('setLevels then getLevels round-trips', async () => {
    const lv = generateLevels();
    lv[0].stars = 3;
    await storage.setLevels(lv);
    const back = await storage.getLevels();
    expect(back[0].stars).toBe(3);
  });
  test('updateLevel mutates the target and unlocks the next on completion', async () => {
    await storage.setLevels(generateLevels());
    await storage.updateLevel(1, { completed: true, stars: 2 });
    const lv = await storage.getLevels();
    expect(lv[0].completed).toBe(true);
    expect(lv[0].stars).toBe(2);
    expect(lv[1].locked).toBe(false); // next level unlocked
  });
  test('updateLevel on the last level does not crash (no next to unlock)', async () => {
    await storage.setLevels(generateLevels());
    await storage.updateLevel(30, { completed: true });
    const lv = await storage.getLevels();
    expect(lv[29].completed).toBe(true);
  });
  test('updateLevel with unknown id is a no-op', async () => {
    await storage.setLevels(generateLevels());
    await storage.updateLevel(999, { completed: true });
    const lv = await storage.getLevels();
    expect(lv.every(l => !l.completed)).toBe(true);
  });
});

describe('stats persistence', () => {
  test('getStats returns zeroed defaults when empty', async () => {
    const s = await storage.getStats();
    expect(s).toEqual({
      gamesPlayed: 0,
      gamesWon: 0,
      totalTime: 0,
      currentStreak: 0,
      bestStreak: 0,
      hintsUsed: 0,
      perfectGames: 0,
    });
  });
  test('updateStats merges partial updates', async () => {
    await storage.updateStats({ gamesPlayed: 2, gamesWon: 1 });
    await storage.updateStats({ gamesWon: 2 });
    const s = await storage.getStats();
    expect(s.gamesPlayed).toBe(2);
    expect(s.gamesWon).toBe(2);
  });
});

describe('settings persistence', () => {
  test('getSettings returns defaults when empty', async () => {
    const s = await storage.getSettings();
    expect(s).toEqual({
      language: 'en',
      sound: true,
      music: true,
      vibration: true,
      darkMode: true,
      notifications: true,
    });
  });
  test('setSettings then getSettings round-trips', async () => {
    await storage.setSettings({
      language: 'fr', sound: false, music: false, vibration: false, darkMode: false, notifications: false,
    });
    const s = await storage.getSettings();
    expect(s.language).toBe('fr');
    expect(s.sound).toBe(false);
  });
});

describe('achievements persistence', () => {
  test('getAchievements returns defaults when empty', async () => {
    const a = await storage.getAchievements();
    expect(a).toHaveLength(ACHIEVEMENTS.length);
  });
  test('updateAchievement mutates a single achievement', async () => {
    await storage.updateAchievement('first_win', { unlocked: true, progress: 1 });
    const a = await storage.getAchievements();
    expect(a.find(x => x.id === 'first_win')?.unlocked).toBe(true);
  });
  test('updateAchievement with unknown id is a no-op', async () => {
    await storage.updateAchievement('nope', { unlocked: true });
    const a = await storage.getAchievements();
    expect(a.find(x => x.id === 'nope')).toBeUndefined();
  });
});

describe('checkAchievements', () => {
  // Each test starts from a freshly-seeded clone (see the top-level beforeEach),
  // so checkAchievements never mutates the shared module-level ACHIEVEMENTS.
  test('unlocks first_win once a game is won', async () => {
    await storage.updateStats({ gamesWon: 1 });
    const newly = await storage.checkAchievements({ win: true, timeThisGame: 300, hintsThisGame: 0 });
    expect(newly.some(a => a.id === 'first_win')).toBe(true);
    const all = await storage.getAchievements();
    expect(all.find(a => a.id === 'first_win')?.unlocked).toBe(true);
  });
  test('unlocks speed_demon for a fast win (<120s, time>0)', async () => {
    const newly = await storage.checkAchievements({ win: true, timeThisGame: 90, hintsThisGame: 0 });
    expect(newly.some(a => a.id === 'speed_demon')).toBe(true);
  });
  test('does not unlock speed_demon for a slow win', async () => {
    const newly = await storage.checkAchievements({ win: true, timeThisGame: 300, hintsThisGame: 0 });
    expect(newly.some(a => a.id === 'speed_demon')).toBe(false);
  });
  test('no_hints progresses on a hint-free win', async () => {
    await storage.checkAchievements({ win: true, timeThisGame: 200, hintsThisGame: 0 });
    const all = await storage.getAchievements();
    expect(all.find(a => a.id === 'no_hints')?.progress).toBe(1);
  });
  test('collector unlocks when user has ≥50 stars', async () => {
    await storage.setUser(mkUser({ stars: 50 }));
    const newly = await storage.checkAchievements({ win: false, timeThisGame: 0, hintsThisGame: 0 });
    expect(newly.some(a => a.id === 'collector')).toBe(true);
  });
  test('level_10 unlocks when xp gives level ≥10', async () => {
    await storage.setUser(mkUser({ xp: 900 })); // level = floor(900/100)+1 = 10
    const newly = await storage.checkAchievements({ win: false, timeThisGame: 0, hintsThisGame: 0 });
    expect(newly.some(a => a.id === 'level_10')).toBe(true);
  });
  test('level_30 unlocks when all 30 levels completed', async () => {
    const lv = generateLevels().map(l => ({ ...l, completed: true })) as LevelData[];
    await storage.setLevels(lv);
    const newly = await storage.checkAchievements({ win: false, timeThisGame: 0, hintsThisGame: 0 });
    expect(newly.some(a => a.id === 'level_30')).toBe(true);
  });
  test('already-unlocked achievements are skipped (welcome stays, not re-reported)', async () => {
    const newly = await storage.checkAchievements({ win: false, timeThisGame: 0, hintsThisGame: 0 });
    expect(newly.some(a => a.id === 'welcome')).toBe(false);
  });
});

describe('auth flows (login / guest / logout)', () => {
  test('isLoggedIn reflects token presence', async () => {
    expect(await storage.isLoggedIn()).toBe(false);
    mockStore.set('sudoku_auth_token', 'abc');
    expect(await storage.isLoggedIn()).toBe(true);
  });

  test('login succeeds via backend and stores user + both token keys', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, token: 'JWT123', user: { id: 'srv1', username: 'idriss1', email: 'i@x.com' } }),
    })) as any;
    const u = await storage.login('i@x.com', 'pw');
    expect(u?.username).toBe('idriss1');
    expect(mockStore.get('sudoku_token')).toBe('JWT123');
    expect(mockStore.get('sudoku_auth_token')).toBe('JWT123');
    expect(await storage.isLoggedIn()).toBe(true);
  });

  test('login falls back to TEST_USERS when backend is unreachable', async () => {
    global.fetch = jest.fn(async () => { throw new Error('network down'); }) as any;
    const u = await storage.login('test@test.com', 'test123');
    // TEST_USERS exists only in DEV; jest defines __DEV__ true so fallback works
    expect(u).not.toBeNull();
    expect(u?.email).toBe('test@test.com');
    expect(await storage.isLoggedIn()).toBe(true);
  });

  test('login returns null for unknown creds when backend rejects', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ success: false }) })) as any;
    const u = await storage.login('ghost@nowhere.com', 'bad');
    expect(u).toBeNull();
  });

  test('loginAsGuest registers a backend guest and stores tokens', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, token: 'GUESTJWT', user: { id: 'g1', username: 'Guest_abc', email: 'guest_abc@guest.local' } }),
    })) as any;
    const u = await storage.loginAsGuest();
    expect(u.username).toBe('Guest_abc');
    expect(mockStore.get('sudoku_token')).toBe('GUESTJWT');
    expect(mockStore.get('sudoku_auth_token')).toBe('GUESTJWT');
  });

  test('loginAsGuest falls back to an offline guest when backend fails', async () => {
    global.fetch = jest.fn(async () => { throw new Error('offline'); }) as any;
    const u = await storage.loginAsGuest();
    expect(u.id).toMatch(/^guest_/);
    expect(u.coins).toBe(50);
    expect(mockStore.get('sudoku_auth_token')).toBe('guest_token');
  });

  test('logout clears the user', async () => {
    await storage.setUser(mkUser());
    mockStore.set('sudoku_auth_token', 'tok');
    await storage.logout();
    expect(await storage.getUser()).toBeNull();
    expect(await storage.isLoggedIn()).toBe(false);
  });
});

describe('resetAll', () => {
  test('removes all known keys', async () => {
    await storage.setUser(mkUser());
    await storage.setLevels(generateLevels());
    await storage.updateStats({ gamesPlayed: 5 });
    mockStore.set('sudoku_auth_token', 'tok');
    await storage.resetAll();
    expect(await storage.getUser()).toBeNull();
    expect(await storage.isLoggedIn()).toBe(false);
    // stats back to defaults
    expect((await storage.getStats()).gamesPlayed).toBe(0);
  });
});
