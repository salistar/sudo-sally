/**
 * Tests for utils/api.ts — the ApiService.
 *
 * We mock global.fetch and assert that each method hits the right URL with the
 * right method/body, attaches the Bearer token once set, parses JSON, and
 * throws on a non-ok response.
 */
import { api, SERVER_URL, API_URL, RELAY_WSS } from '../api';

type Call = { url: string; init: RequestInit };
let calls: Call[];

function mockFetch(impl: (url: string, init: RequestInit) => { ok?: boolean; body?: any }) {
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const { ok = true, body = {} } = impl(url, init);
    return { ok, json: async () => body } as any;
  }) as any;
}

beforeEach(() => {
  calls = [];
  api.clearToken();
});

describe('exported URL constants', () => {
  test('derive from the single SERVER_URL source', () => {
    expect(SERVER_URL).toBe('https://api.sallysudo.com');
    expect(API_URL).toBe('https://api.sallysudo.com/api');
    expect(RELAY_WSS).toBe('wss://api.sallysudo.com/api/youtube/ingest');
  });
});

describe('request plumbing', () => {
  test('GET with no token: correct URL, JSON Content-Type, no Authorization', async () => {
    mockFetch(() => ({ body: { ok: 1 } }));
    const res = await api.getMe();
    expect(res).toEqual({ ok: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API_URL}/auth/me`);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBeUndefined();
  });

  test('attaches Bearer token once setToken is called', async () => {
    mockFetch(() => ({ body: {} }));
    api.setToken('TOK42');
    await api.getMe();
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TOK42');
  });

  test('clearToken removes the Authorization header again', async () => {
    mockFetch(() => ({ body: {} }));
    api.setToken('TOK');
    api.clearToken();
    await api.getMe();
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  test('throws with the server-provided error on a non-ok response', async () => {
    mockFetch(() => ({ ok: false, body: { error: 'Bad creds' } }));
    await expect(api.login('a@b.com', 'x')).rejects.toThrow('Bad creds');
  });

  test('throws a generic message when no error field is present', async () => {
    mockFetch(() => ({ ok: false, body: {} }));
    await expect(api.getMe()).rejects.toThrow('Request failed');
  });
});

describe('auth methods store the token on success', () => {
  test('register POSTs username/email/password and stores token', async () => {
    mockFetch(() => ({ body: { token: 'REG_TOK', user: { id: 'u1' } } }));
    const res = await api.register('bob', 'b@b.com', 'pw');
    expect(res.token).toBe('REG_TOK');
    expect(calls[0].url).toBe(`${API_URL}/auth/register`);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ username: 'bob', email: 'b@b.com', password: 'pw' });
    // token now attached on the subsequent call (calls[1])
    mockFetch(() => ({ body: {} }));
    await api.getMe();
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer REG_TOK');
  });

  test('login POSTs email/password and stores token', async () => {
    mockFetch(() => ({ body: { token: 'LOGIN_TOK' } }));
    await api.login('a@b.com', 'secret');
    expect(calls[0].url).toBe(`${API_URL}/auth/login`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ email: 'a@b.com', password: 'secret' });
  });

  test('guestLogin POSTs to /auth/guest', async () => {
    mockFetch(() => ({ body: { token: 'G' } }));
    await api.guestLogin();
    expect(calls[0].url).toBe(`${API_URL}/auth/guest`);
    expect(calls[0].init.method).toBe('POST');
  });

  test('login does not set a token when the response omits one', async () => {
    mockFetch(() => ({ body: { success: false } }));
    await api.login('a@b.com', 'x');
    mockFetch(() => ({ body: {} }));
    await api.getMe();
    // calls[1] is the getMe request; no token was stored by the prior login
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe('game endpoints', () => {
  test('startGame defaults isDaily=false', async () => {
    mockFetch(() => ({ body: {} }));
    await api.startGame(7);
    expect(calls[0].url).toBe(`${API_URL}/games/start`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ levelNumber: 7, isDaily: false });
  });
  test('startGame can flag a daily game', async () => {
    mockFetch(() => ({ body: {} }));
    await api.startGame(3, true);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ levelNumber: 3, isDaily: true });
  });
  test('saveGame sends the in-progress state', async () => {
    mockFetch(() => ({ body: {} }));
    await api.saveGame('g1', 'BOARDSTR', 120, 2);
    expect(calls[0].url).toBe(`${API_URL}/games/save`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ gameId: 'g1', currentBoard: 'BOARDSTR', timeSpent: 120, errors: 2 });
  });
  test('completeGame sends the full result', async () => {
    mockFetch(() => ({ body: {} }));
    await api.completeGame('g1', true, 200, 1, 0, 3);
    expect(calls[0].url).toBe(`${API_URL}/games/complete`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ gameId: 'g1', won: true, timeSpent: 200, errors: 1, hintsUsed: 0, stars: 3 });
  });
  test('getHistory builds the query string with defaults', async () => {
    mockFetch(() => ({ body: {} }));
    await api.getHistory();
    expect(calls[0].url).toBe(`${API_URL}/games/history?limit=20&page=1`);
  });
  test('getHistory honours custom limit/page', async () => {
    mockFetch(() => ({ body: {} }));
    await api.getHistory(5, 3);
    expect(calls[0].url).toBe(`${API_URL}/games/history?limit=5&page=3`);
  });
});

describe('simple GET endpoints', () => {
  const cases: [string, () => Promise<any>][] = [
    ['/levels', () => api.getLevels()],
    ['/leaderboard', () => api.getLeaderboard()],
    ['/leaderboard/weekly', () => api.getWeeklyLeaderboard()],
    ['/leaderboard/me', () => api.getMyRank()],
    ['/daily', () => api.getDailyChallenge()],
    ['/shop', () => api.getShopItems()],
    ['/achievements', () => api.getAchievements()],
    ['/achievements/me', () => api.getMyAchievements()],
    ['/stats', () => api.getGlobalStats()],
    ['/stats/me', () => api.getMyStats()],
  ];
  test.each(cases)('GET %s', async (path, fn) => {
    mockFetch(() => ({ body: {} }));
    await fn();
    expect(calls[0].url).toBe(`${API_URL}${path}`);
    expect(calls[0].init.method).toBeUndefined(); // plain GET
  });

  test('getLevel(id) interpolates the id', async () => {
    mockFetch(() => ({ body: {} }));
    await api.getLevel(12);
    expect(calls[0].url).toBe(`${API_URL}/levels/12`);
  });
});

describe('mutating endpoints', () => {
  test('completeDailyChallenge POSTs result', async () => {
    mockFetch(() => ({ body: {} }));
    await api.completeDailyChallenge(150, 0, 3);
    expect(calls[0].url).toBe(`${API_URL}/daily/complete`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ timeSpent: 150, errors: 0, stars: 3 });
  });
  test('buyItem POSTs the itemId', async () => {
    mockFetch(() => ({ body: {} }));
    await api.buyItem('theme_gold');
    expect(calls[0].url).toBe(`${API_URL}/shop/buy`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ itemId: 'theme_gold' });
  });
  test('unlockAchievement POSTs to the id-scoped path', async () => {
    mockFetch(() => ({ body: {} }));
    await api.unlockAchievement('first_win');
    expect(calls[0].url).toBe(`${API_URL}/achievements/first_win/unlock`);
    expect(calls[0].init.method).toBe('POST');
  });
  test('updateSettings PUTs the settings object', async () => {
    mockFetch(() => ({ body: {} }));
    await api.updateSettings({ language: 'fr', sound: false });
    expect(calls[0].url).toBe(`${API_URL}/users/me/settings`);
    expect(calls[0].init.method).toBe('PUT');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ language: 'fr', sound: false });
  });
});
