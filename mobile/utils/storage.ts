import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from './i18n';

// ============ TYPES ============
export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  level: number;
  xp: number;
  coins: number;
  stars: number;
  createdAt: string;
}

export interface LevelData {
  id: number;
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' | 'master';
  stars: number; // 0-3
  bestTime: number | null; // seconds
  completed: boolean;
  locked: boolean;
  hintsUsed: number;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  totalTime: number;
  currentStreak: number;
  bestStreak: number;
  hintsUsed: number;
  perfectGames: number;
}

export interface Achievement {
  id: string;
  title: { en: string; fr: string; ar: string };
  description: { en: string; fr: string; ar: string };
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

export interface Settings {
  language: Language;
  sound: boolean;
  music: boolean;
  vibration: boolean;
  darkMode: boolean;
  notifications: boolean;
}

// ============ MOCK DATA ============

// Test accounts
export const TEST_USERS = [
  { email: 'test@test.com', password: 'test123', username: 'TestPlayer' },
  { email: 'admin@sally.com', password: 'admin123', username: 'SallyAdmin' },
  { email: 'demo@demo.com', password: 'demo', username: 'DemoUser' },
];

// Generate 30 levels with progressive difficulty
export const generateLevels = (): LevelData[] => {
  const levels: LevelData[] = [];
  for (let i = 1; i <= 30; i++) {
    let difficulty: LevelData['difficulty'];
    if (i <= 5) difficulty = 'beginner';
    else if (i <= 10) difficulty = 'easy';
    else if (i <= 15) difficulty = 'medium';
    else if (i <= 20) difficulty = 'hard';
    else if (i <= 25) difficulty = 'expert';
    else difficulty = 'master';
    
    levels.push({
      id: i,
      difficulty,
      stars: 0,
      bestTime: null,
      completed: false,
      locked: i > 1,
      hintsUsed: 0,
    });
  }
  return levels;
};

// Achievements
export const ACHIEVEMENTS: Achievement[] = [
  // v3.6 — Auto-unlocked at register so brand-new users see 1/N instead of 0/N.
  {
    id: 'welcome',
    title: { en: 'Welcome to SallySudo!', fr: 'Bienvenue sur SallySudo !', ar: 'مرحباً بك في SallySudo!' },
    description: { en: 'Created an account', fr: 'Compte créé', ar: 'تم إنشاء الحساب' },
    icon: '🎮',
    unlocked: true,
    progress: 1,
    target: 1,
  },
  {
    id: 'first_win',
    title: { en: 'First Victory', fr: 'Première Victoire', ar: 'الفوز الأول' },
    description: { en: 'Complete your first puzzle', fr: 'Complétez votre premier puzzle', ar: 'أكمل أول لغز' },
    icon: '🏆',
    unlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: 'speed_demon',
    title: { en: 'Speed Demon', fr: 'Démon de Vitesse', ar: 'شيطان السرعة' },
    description: { en: 'Complete a puzzle under 2 minutes', fr: 'Complétez en moins de 2 minutes', ar: 'أكمل في أقل من دقيقتين' },
    icon: '⚡',
    unlocked: false,
    progress: 0,
    target: 1,
  },
  {
    id: 'perfect_10',
    title: { en: 'Perfect 10', fr: 'Parfait 10', ar: 'عشرة مثالية' },
    description: { en: 'Complete 10 puzzles without errors', fr: '10 puzzles sans erreurs', ar: '10 ألغاز بدون أخطاء' },
    icon: '💎',
    unlocked: false,
    progress: 0,
    target: 10,
  },
  {
    id: 'streak_master',
    title: { en: 'Streak Master', fr: 'Maître des Séries', ar: 'سيد السلاسل' },
    description: { en: 'Win 7 games in a row', fr: 'Gagnez 7 parties de suite', ar: 'اربح 7 ألعاب متتالية' },
    icon: '🔥',
    unlocked: false,
    progress: 0,
    target: 7,
  },
  {
    id: 'no_hints',
    title: { en: 'Pure Skill', fr: 'Talent Pur', ar: 'مهارة خالصة' },
    description: { en: 'Complete 5 puzzles without hints', fr: '5 puzzles sans indices', ar: '5 ألغاز بدون تلميحات' },
    icon: '🧠',
    unlocked: false,
    progress: 0,
    target: 5,
  },
  {
    id: 'level_10',
    title: { en: 'Rising Star', fr: 'Étoile Montante', ar: 'نجم صاعد' },
    description: { en: 'Reach level 10', fr: 'Atteignez le niveau 10', ar: 'وصول للمستوى 10' },
    icon: '⭐',
    unlocked: false,
    progress: 0,
    target: 10,
  },
  {
    id: 'level_20',
    title: { en: 'Expert Player', fr: 'Joueur Expert', ar: 'لاعب خبير' },
    description: { en: 'Reach level 20', fr: 'Atteignez le niveau 20', ar: 'وصول للمستوى 20' },
    icon: '🌟',
    unlocked: false,
    progress: 0,
    target: 20,
  },
  {
    id: 'level_30',
    title: { en: 'Sudoku Master', fr: 'Maître Sudoku', ar: 'سيد السودوكو' },
    description: { en: 'Complete all 30 levels', fr: 'Complétez les 30 niveaux', ar: 'أكمل كل 30 مستوى' },
    icon: '👑',
    unlocked: false,
    progress: 0,
    target: 30,
  },
  {
    id: 'collector',
    title: { en: 'Star Collector', fr: 'Collectionneur', ar: 'جامع النجوم' },
    description: { en: 'Collect 50 stars', fr: 'Collectez 50 étoiles', ar: 'اجمع 50 نجمة' },
    icon: '✨',
    unlocked: false,
    progress: 0,
    target: 50,
  },
  {
    id: 'dedicated',
    title: { en: 'Dedicated Player', fr: 'Joueur Dévoué', ar: 'لاعب مخلص' },
    description: { en: 'Play for 1 hour total', fr: 'Jouez 1 heure au total', ar: 'العب ساعة إجمالاً' },
    icon: '⏰',
    unlocked: false,
    progress: 0,
    target: 3600,
  },
];

// Leaderboard mock data
export const LEADERBOARD = [
  { rank: 1, username: 'SudokuKing', stars: 87, avatar: '👑' },
  { rank: 2, username: 'PuzzleMaster', stars: 82, avatar: '🧩' },
  { rank: 3, username: 'BrainStorm', stars: 78, avatar: '🧠' },
  { rank: 4, username: 'QuickSolver', stars: 74, avatar: '⚡' },
  { rank: 5, username: 'LogicPro', stars: 71, avatar: '🎯' },
  { rank: 6, username: 'NumberNinja', stars: 68, avatar: '🥷' },
  { rank: 7, username: 'GridGuru', stars: 65, avatar: '📊' },
  { rank: 8, username: 'PatternFinder', stars: 61, avatar: '🔍' },
  { rank: 9, username: 'CellMaster', stars: 58, avatar: '📱' },
  { rank: 10, username: 'MathWizard', stars: 55, avatar: '🧙' },
];

// ============ STORAGE KEYS ============
const KEYS = {
  USER: 'sudoku_user',
  LEVELS: 'sudoku_levels',
  STATS: 'sudoku_stats',
  SETTINGS: 'sudoku_settings',
  ACHIEVEMENTS: 'sudoku_achievements',
  AUTH_TOKEN: 'sudoku_auth_token',
};

// ============ STORAGE FUNCTIONS ============

export const storage = {
  // User
  async getUser(): Promise<User | null> {
    const data = await AsyncStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  },
  
  async setUser(user: User): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },
  
  async clearUser(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.USER);
    await AsyncStorage.removeItem(KEYS.AUTH_TOKEN);
  },

  // Levels
  async getLevels(): Promise<LevelData[]> {
    const data = await AsyncStorage.getItem(KEYS.LEVELS);
    return data ? JSON.parse(data) : generateLevels();
  },
  
  async setLevels(levels: LevelData[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.LEVELS, JSON.stringify(levels));
  },
  
  async updateLevel(levelId: number, updates: Partial<LevelData>): Promise<void> {
    const levels = await this.getLevels();
    const index = levels.findIndex(l => l.id === levelId);
    if (index !== -1) {
      levels[index] = { ...levels[index], ...updates };
      // Unlock next level
      if (updates.completed && index + 1 < levels.length) {
        levels[index + 1].locked = false;
      }
      await this.setLevels(levels);
    }
  },

  // Stats
  async getStats(): Promise<GameStats> {
    const data = await AsyncStorage.getItem(KEYS.STATS);
    return data ? JSON.parse(data) : {
      gamesPlayed: 0,
      gamesWon: 0,
      totalTime: 0,
      currentStreak: 0,
      bestStreak: 0,
      hintsUsed: 0,
      perfectGames: 0,
    };
  },
  
  async updateStats(updates: Partial<GameStats>): Promise<void> {
    const stats = await this.getStats();
    await AsyncStorage.setItem(KEYS.STATS, JSON.stringify({ ...stats, ...updates }));
  },

  // Settings
  async getSettings(): Promise<Settings> {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      language: 'en',
      sound: true,
      music: true,
      vibration: true,
      darkMode: true,
      notifications: true,
    };
  },
  
  async setSettings(settings: Settings): Promise<void> {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Achievements
  async getAchievements(): Promise<Achievement[]> {
    const data = await AsyncStorage.getItem(KEYS.ACHIEVEMENTS);
    return data ? JSON.parse(data) : ACHIEVEMENTS;
  },
  
  async updateAchievement(id: string, updates: Partial<Achievement>): Promise<void> {
    const achievements = await this.getAchievements();
    const index = achievements.findIndex(a => a.id === id);
    if (index !== -1) {
      achievements[index] = { ...achievements[index], ...updates };
      await AsyncStorage.setItem(KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
    }
  },

  // Auth
  async isLoggedIn(): Promise<boolean> {
    const token = await AsyncStorage.getItem(KEYS.AUTH_TOKEN);
    return !!token;
  },
  
  async login(email: string, password: string): Promise<User | null> {
    // 1) Real backend login (any user registered via the prod API — idriss1, idriss2, ...)
    try {
      const res = await fetch('https://api.sallysudo.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data.token) {
          const u = data.user || {};
          const user: User = {
            id: u.id || u._id || 'u_' + Math.random().toString(36).slice(2, 9),
            username: u.username || email.split('@')[0],
            email: u.email || email,
            avatar: u.avatar || '🎮',
            level: u.level ?? 1,
            xp: u.xp ?? 0,
            coins: u.coins ?? 100,
            stars: u.stars ?? 0,
            createdAt: u.createdAt || new Date().toISOString(),
          };
          await this.setUser(user);
          // store under BOTH keys: 'sudoku_token' (read by utils/socket + utils/api)
          // and KEYS.AUTH_TOKEN (read by isLoggedIn).
          await AsyncStorage.setItem('sudoku_token', data.token);
          await AsyncStorage.setItem(KEYS.AUTH_TOKEN, data.token);
          return user;
        }
      }
    } catch (e) {
      console.log('[storage] login API error:', String(e));
    }
    // 2) Fallback: local TEST_USERS (legacy demo accounts that don't exist in the backend)
    const testUser = TEST_USERS.find(u => u.email === email && u.password === password);
    if (testUser) {
      const user: User = {
        id: Math.random().toString(36).substr(2, 9),
        username: testUser.username,
        email: testUser.email,
        avatar: '🎮',
        level: 1,
        xp: 0,
        coins: 100,
        stars: 0,
        createdAt: new Date().toISOString(),
      };
      await this.setUser(user);
      await AsyncStorage.setItem(KEYS.AUTH_TOKEN, 'mock_token_' + user.id);
      return user;
    }
    return null;
  },
  
  async loginAsGuest(): Promise<User> {
    const user: User = {
      id: 'guest_' + Math.random().toString(36).substr(2, 9),
      username: 'Guest',
      email: '',
      avatar: '👤',
      level: 1,
      xp: 0,
      coins: 50,
      stars: 0,
      createdAt: new Date().toISOString(),
    };
    await this.setUser(user);
    await AsyncStorage.setItem(KEYS.AUTH_TOKEN, 'guest_token');
    return user;
  },
  
  async logout(): Promise<void> {
    await this.clearUser();
  },

  // Reset all data
  async resetAll(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.USER, KEYS.LEVELS, KEYS.STATS, KEYS.SETTINGS, KEYS.ACHIEVEMENTS, KEYS.AUTH_TOKEN]);
  },
};

// ============ HELPER FUNCTIONS ============

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const calculateStars = (time: number, difficulty: string, errors: number): number => {
  const baseTimes: Record<string, number> = {
    beginner: 180,
    easy: 300,
    medium: 480,
    hard: 600,
    expert: 900,
    master: 1200,
  };
  
  const baseTime = baseTimes[difficulty] || 300;
  
  if (errors >= 3) return 1;
  if (time <= baseTime * 0.5 && errors === 0) return 3;
  if (time <= baseTime && errors <= 1) return 2;
  return 1;
};

export const calculateXP = (stars: number, difficulty: string): number => {
  const multipliers: Record<string, number> = {
    beginner: 1,
    easy: 1.5,
    medium: 2,
    hard: 3,
    expert: 4,
    master: 5,
  };
  return Math.round(stars * 10 * (multipliers[difficulty] || 1));
};
