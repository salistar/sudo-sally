// MongoDB Initialization Script
db = db.getSiblingDB('sudoku_sally');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: { bsonType: 'string', minLength: 3, maxLength: 20 },
        email: { bsonType: 'string' },
        password: { bsonType: 'string' }
      }
    }
  }
});

db.createCollection('games');
db.createCollection('levels');
db.createCollection('achievements');
db.createCollection('dailychallenges');
db.createCollection('shopitems');
db.createCollection('leaderboardentries');

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ stars: -1 });
db.games.createIndex({ user: 1, startedAt: -1 });
db.games.createIndex({ status: 1 });
db.levels.createIndex({ levelNumber: 1 }, { unique: true });
db.dailychallenges.createIndex({ date: 1 }, { unique: true });
db.leaderboardentries.createIndex({ period: 1, periodKey: 1, stars: -1 });

// Insert default achievements
db.achievements.insertMany([
  { achievementId: 'first_win', title: { en: 'First Victory', fr: 'Première Victoire', ar: 'الفوز الأول' }, description: { en: 'Complete your first puzzle', fr: 'Complétez votre premier puzzle', ar: 'أكمل أول لغز' }, icon: '🏆', category: 'progress', requirement: { type: 'games_won', target: 1 }, rewards: { xp: 50, coins: 25 }, rarity: 'common', isActive: true },
  { achievementId: 'speed_demon', title: { en: 'Speed Demon', fr: 'Démon de Vitesse', ar: 'شيطان السرعة' }, description: { en: 'Complete under 2 minutes', fr: 'Complétez en moins de 2 min', ar: 'أكمل في أقل من دقيقتين' }, icon: '⚡', category: 'skill', requirement: { type: 'fast_complete', target: 120 }, rewards: { xp: 100, coins: 50 }, rarity: 'rare', isActive: true },
  { achievementId: 'perfect_10', title: { en: 'Perfect 10', fr: 'Parfait 10', ar: 'عشرة مثالية' }, description: { en: '10 puzzles without errors', fr: '10 puzzles sans erreurs', ar: '10 ألغاز بدون أخطاء' }, icon: '💎', category: 'skill', requirement: { type: 'perfect_games', target: 10 }, rewards: { xp: 200, coins: 100 }, rarity: 'epic', isActive: true },
  { achievementId: 'streak_master', title: { en: 'Streak Master', fr: 'Maître des Séries', ar: 'سيد السلاسل' }, description: { en: 'Win 7 games in a row', fr: 'Gagnez 7 parties de suite', ar: 'اربح 7 ألعاب متتالية' }, icon: '🔥', category: 'progress', requirement: { type: 'streak', target: 7 }, rewards: { xp: 150, coins: 75 }, rarity: 'rare', isActive: true },
  { achievementId: 'collector', title: { en: 'Star Collector', fr: 'Collectionneur', ar: 'جامع النجوم' }, description: { en: 'Collect 100 stars', fr: 'Collectez 100 étoiles', ar: 'اجمع 100 نجمة' }, icon: '✨', category: 'collection', requirement: { type: 'stars', target: 100 }, rewards: { xp: 300, coins: 150 }, rarity: 'epic', isActive: true },
  { achievementId: 'master', title: { en: 'Sudoku Master', fr: 'Maître Sudoku', ar: 'سيد السودوكو' }, description: { en: 'Complete all 30 levels', fr: 'Complétez les 30 niveaux', ar: 'أكمل كل 30 مستوى' }, icon: '👑', category: 'progress', requirement: { type: 'levels_completed', target: 30 }, rewards: { xp: 500, coins: 250, theme: 'gold' }, rarity: 'legendary', isActive: true }
]);

// Insert shop items
db.shopitems.insertMany([
  { itemId: 'theme_ocean', type: 'theme', name: { en: 'Ocean Blue', fr: 'Bleu Océan', ar: 'أزرق المحيط' }, price: 0, themeData: { primary: '#3b82f6', secondary: '#2563eb', background: ['#0a1628', '#1e3a5f', '#0f2744'], accent: '#60a5fa' }, isActive: true },
  { itemId: 'theme_sunset', type: 'theme', name: { en: 'Sunset Orange', fr: 'Orange Coucher', ar: 'برتقالي الغروب' }, price: 100, themeData: { primary: '#f97316', secondary: '#ea580c', background: ['#1a0a0a', '#3a1a1a', '#2a0f0f'], accent: '#fb923c' }, isActive: true },
  { itemId: 'theme_purple', type: 'theme', name: { en: 'Royal Purple', fr: 'Violet Royal', ar: 'أرجواني ملكي' }, price: 150, themeData: { primary: '#a855f7', secondary: '#9333ea', background: ['#0f0a1a', '#1f1a3a', '#150f2a'], accent: '#c084fc' }, isActive: true },
  { itemId: 'theme_gold', type: 'theme', name: { en: 'Golden', fr: 'Doré', ar: 'ذهبي' }, price: 200, themeData: { primary: '#eab308', secondary: '#ca8a04', background: ['#1a1a0a', '#3a3a1a', '#2a2a0f'], accent: '#fbbf24' }, isActive: true },
  { itemId: 'powerup_hint_5', type: 'powerup', name: { en: '5 Extra Hints', fr: '5 Indices Bonus', ar: '5 تلميحات إضافية' }, price: 50, powerupData: { effect: 'hint', quantity: 5 }, isActive: true },
  { itemId: 'powerup_freeze_3', type: 'powerup', name: { en: '3 Time Freeze', fr: '3 Gels du Temps', ar: '3 تجميد الوقت' }, price: 75, powerupData: { effect: 'freeze', quantity: 3 }, isActive: true }
]);

// Insert 30 levels
for (let i = 1; i <= 30; i++) {
  let difficulty;
  if (i <= 5) difficulty = 'beginner';
  else if (i <= 10) difficulty = 'easy';
  else if (i <= 15) difficulty = 'medium';
  else if (i <= 20) difficulty = 'hard';
  else if (i <= 25) difficulty = 'expert';
  else difficulty = 'master';
  
  db.levels.insertOne({
    levelNumber: i,
    difficulty: difficulty,
    puzzle: JSON.stringify(Array(9).fill(null).map(() => Array(9).fill(null))),
    solution: JSON.stringify(Array(9).fill(null).map(() => Array(9).fill(1))),
    maxErrors: 3,
    hintsAllowed: difficulty === 'master' ? 1 : difficulty === 'expert' ? 2 : 3,
    rewards: {
      xp: 10 + (i * 2),
      coins: 5 + i,
      stars: { threeStarTime: 120 + (i * 30), twoStarTime: 240 + (i * 60) }
    },
    isActive: true
  });
}

// Create admin user
db.users.insertOne({
  username: 'admin',
  email: 'admin@sudokusally.com',
  password: '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // bcrypt hash of 'admin123'
  avatar: '👑',
  role: 'admin',
  level: 99,
  xp: 99999,
  coins: 99999,
  stars: 999,
  createdAt: new Date()
});

print('✅ Database initialized successfully!');
