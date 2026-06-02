/**
 * API Service — connects to the SallySudo backend (VPS prod).
 *
 * The shipped APK ALWAYS talks to the production API. There is no dev URL
 * baked into release builds. The commented snippet below is kept as
 * documentation for contributors who want to point a local Expo Go session
 * at a self-hosted Docker backend.
 */
// import Constants from 'expo-constants';   // re-enable if you uncomment the dev block below

const SERVER_URL = 'https://api.sudoku.gowithsally.com';

// ── Dev-only override (kept for reference, NEVER reached in release APK) ──
// const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
// const USE_LOCAL_BACKEND = __DEV__ && false;
// if (USE_LOCAL_BACKEND && devHost) SERVER_URL = `http://${devHost}:3101`;

const API_URL = `${SERVER_URL}/api`;

class ApiService {
  private token: string | null = null;

  setToken(token: string) { this.token = token; }
  clearToken() { this.token = null; }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // Auth
  async register(username: string, email: string, password: string) {
    const data = await this.request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async guestLogin() {
    const data = await this.request('/auth/guest', { method: 'POST' });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async getMe() { return this.request('/auth/me'); }

  // Games
  async startGame(levelNumber: number, isDaily = false) {
    return this.request('/games/start', { method: 'POST', body: JSON.stringify({ levelNumber, isDaily }) });
  }

  async saveGame(gameId: string, currentBoard: string, timeSpent: number, errors: number) {
    return this.request('/games/save', { method: 'POST', body: JSON.stringify({ gameId, currentBoard, timeSpent, errors }) });
  }

  async completeGame(gameId: string, won: boolean, timeSpent: number, errors: number, hintsUsed: number, stars: number) {
    return this.request('/games/complete', { method: 'POST', body: JSON.stringify({ gameId, won, timeSpent, errors, hintsUsed, stars }) });
  }

  async getHistory(limit = 20, page = 1) { return this.request(`/games/history?limit=${limit}&page=${page}`); }

  // Levels
  async getLevels() { return this.request('/levels'); }
  async getLevel(id: number) { return this.request(`/levels/${id}`); }

  // Leaderboard
  async getLeaderboard() { return this.request('/leaderboard'); }
  async getWeeklyLeaderboard() { return this.request('/leaderboard/weekly'); }
  async getMyRank() { return this.request('/leaderboard/me'); }

  // Daily Challenge
  async getDailyChallenge() { return this.request('/daily'); }
  async completeDailyChallenge(timeSpent: number, errors: number, stars: number) {
    return this.request('/daily/complete', { method: 'POST', body: JSON.stringify({ timeSpent, errors, stars }) });
  }

  // Shop
  async getShopItems() { return this.request('/shop'); }
  async buyItem(itemId: string) { return this.request('/shop/buy', { method: 'POST', body: JSON.stringify({ itemId }) }); }

  // Achievements
  async getAchievements() { return this.request('/achievements'); }
  async getMyAchievements() { return this.request('/achievements/me'); }
  async unlockAchievement(id: string) { return this.request(`/achievements/${id}/unlock`, { method: 'POST' }); }

  // Stats
  async getGlobalStats() { return this.request('/stats'); }
  async getMyStats() { return this.request('/stats/me'); }

  // User
  async updateSettings(settings: object) { return this.request('/users/me/settings', { method: 'PUT', body: JSON.stringify(settings) }); }
}

export const api = new ApiService();
export default api;
