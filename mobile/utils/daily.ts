// Daily Challenge System - Feature #22
export interface DailyChallenge {
  date: string;
  seed: number;
  difficulty: 'medium' | 'hard' | 'expert';
  completed: boolean;
  time: number | null;
  stars: number;
}

export const getDailyChallenge = (): DailyChallenge => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const seed = parseInt(dateStr.replace(/-/g, ''));
  
  // Rotate difficulty based on day of week
  const dayOfWeek = today.getDay();
  const difficulty = dayOfWeek < 3 ? 'medium' : dayOfWeek < 6 ? 'hard' : 'expert';
  
  return {
    date: dateStr,
    seed,
    difficulty,
    completed: false,
    time: null,
    stars: 0,
  };
};

export const getDailySeed = (): number => {
  const today = new Date();
  return parseInt(today.toISOString().split('T')[0].replace(/-/g, ''));
};
