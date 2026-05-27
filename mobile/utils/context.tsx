import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage, User, LevelData, GameStats, Settings, Achievement } from './storage';
import { Language } from './i18n';

interface AppState {
  user: User | null;
  levels: LevelData[];
  stats: GameStats;
  settings: Settings;
  achievements: Achievement[];
  isLoading: boolean;
  isLoggedIn: boolean;
}

interface AppContextType extends AppState {
  setUser: (user: User | null) => void;
  setLevels: (levels: LevelData[]) => void;
  setStats: (stats: GameStats) => void;
  setSettings: (settings: Settings) => void;
  setAchievements: (achievements: Achievement[]) => void;
  setLanguage: (lang: Language) => void;
  refreshData: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [stats, setStats] = useState<GameStats>({
    gamesPlayed: 0,
    gamesWon: 0,
    totalTime: 0,
    currentStreak: 0,
    bestStreak: 0,
    hintsUsed: 0,
    perfectGames: 0,
  });
  const [settings, setSettings] = useState<Settings>({
    language: 'en',
    sound: true,
    music: true,
    vibration: true,
    darkMode: true,
    notifications: true,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [userData, levelsData, statsData, settingsData, achievementsData, loggedIn] = await Promise.all([
        storage.getUser(),
        storage.getLevels(),
        storage.getStats(),
        storage.getSettings(),
        storage.getAchievements(),
        storage.isLoggedIn(),
      ]);
      
      setUser(userData);
      setLevels(levelsData);
      setStats(statsData);
      setSettings(settingsData);
      setAchievements(achievementsData);
      setIsLoggedIn(loggedIn);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const setLanguage = async (lang: Language) => {
    const newSettings = { ...settings, language: lang };
    setSettings(newSettings);
    await storage.setSettings(newSettings);
  };

  const logout = async () => {
    await storage.logout();
    setUser(null);
    setIsLoggedIn(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <AppContext.Provider value={{
      user,
      levels,
      stats,
      settings,
      achievements,
      isLoading,
      isLoggedIn,
      setUser,
      setLevels,
      setStats,
      setSettings,
      setAchievements,
      setLanguage,
      refreshData,
      logout,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
