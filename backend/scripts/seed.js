#!/usr/bin/env node
/**
 * Database Seeding Script
 * Run: node scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');

// Import models
const User = require('../src/models/User');
const Level = require('../src/models/Level');
const Achievement = require('../src/models/Achievement');
const ShopItem = require('../src/models/ShopItem');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27117/sudoku_sally';

// Seed credentials come from env; if absent, generate strong random ones and
// print them once. No hardcoded admin123/test123/demo passwords in source.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
const TEST_PASSWORD  = process.env.SEED_TEST_PASSWORD  || crypto.randomBytes(9).toString('base64url');
const DEMO_PASSWORD  = process.env.SEED_DEMO_PASSWORD  || crypto.randomBytes(9).toString('base64url');

// Sudoku puzzle generator
function generateSudoku(difficulty) {
  const base = [
    [5,3,4,6,7,8,9,1,2],
    [6,7,2,1,9,5,3,4,8],
    [1,9,8,3,4,2,5,6,7],
    [8,5,9,7,6,1,4,2,3],
    [4,2,6,8,5,3,7,9,1],
    [7,1,3,9,2,4,8,5,6],
    [9,6,1,5,3,7,2,8,4],
    [2,8,7,4,1,9,6,3,5],
    [3,4,5,2,8,6,1,7,9]
  ];
  
  const solution = base.map(row => [...row]);
  const puzzle = base.map(row => [...row]);
  
  const removeCounts = {
    'beginner': 30, 'easy': 35, 'medium': 40,
    'hard': 45, 'expert': 50, 'master': 55
  };
  
  let removed = 0;
  const toRemove = removeCounts[difficulty] || 40;
  
  while (removed < toRemove) {
    const row = Math.floor(Math.random() * 9);
    const col = Math.floor(Math.random() * 9);
    if (puzzle[row][col] !== 0) {
      puzzle[row][col] = 0;
      removed++;
    }
  }
  
  return { puzzle, solution };
}

async function seed() {
  try {
    console.log('🌱 Starting database seed...');
    console.log(`📡 Connecting to: ${MONGODB_URI}`);
    
    // Guard: this script wipes ALL users/levels/achievements/shop. Never let it
    // run against a production DB by accident — require FORCE_SEED=1 to override.
    if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== '1') {
      console.error('✖ Refusing to seed in production (deletes all data). Set FORCE_SEED=1 to override.');
      process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Level.deleteMany({}),
      Achievement.deleteMany({}),
      ShopItem.deleteMany({})
    ]);

    // Seed Users
    console.log('👥 Creating test users...');
    const users = [
      { username: 'admin', email: 'admin@sudokusally.com', password: ADMIN_PASSWORD, role: 'admin', coins: 99999, stars: 999 },
      { username: 'testuser', email: 'test@test.com', password: TEST_PASSWORD, role: 'user', coins: 500, stars: 50 },
      { username: 'demo', email: 'demo@demo.com', password: DEMO_PASSWORD, role: 'user', coins: 100, stars: 10 }
    ];
    
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      console.log(`   ✓ Created user: ${userData.username}`);
    }

    // Seed Levels
    console.log('🎮 Creating 30 levels...');
    const difficulties = ['beginner', 'easy', 'medium', 'hard', 'expert', 'master'];
    
    for (let i = 1; i <= 30; i++) {
      const diffIndex = Math.floor((i - 1) / 5);
      const difficulty = difficulties[Math.min(diffIndex, 5)];
      const { puzzle, solution } = generateSudoku(difficulty);
      
      await Level.create({
        levelNumber: i,
        difficulty,
        puzzle: JSON.stringify(puzzle),
        solution: JSON.stringify(solution),
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
    console.log('   ✓ Created 30 levels');

    // Seed Achievements
    console.log('🏆 Creating achievements...');
    const achievements = [
      { achievementId: 'first_win', title: { en: 'First Victory', fr: 'Première Victoire', ar: 'الفوز الأول' }, icon: '🏆', category: 'progress', requirement: { type: 'games_won', target: 1 }, rewards: { xp: 50, coins: 25 }, rarity: 'common' },
      { achievementId: 'speed_demon', title: { en: 'Speed Demon', fr: 'Démon de Vitesse', ar: 'شيطان السرعة' }, icon: '⚡', category: 'skill', requirement: { type: 'fast_complete', target: 120 }, rewards: { xp: 100, coins: 50 }, rarity: 'rare' },
      { achievementId: 'perfect_10', title: { en: 'Perfect 10', fr: 'Parfait 10', ar: 'عشرة مثالية' }, icon: '💎', category: 'skill', requirement: { type: 'perfect_games', target: 10 }, rewards: { xp: 200, coins: 100 }, rarity: 'epic' },
      { achievementId: 'streak_7', title: { en: 'Streak Master', fr: 'Maître des Séries', ar: 'سيد السلاسل' }, icon: '🔥', category: 'progress', requirement: { type: 'streak', target: 7 }, rewards: { xp: 150, coins: 75 }, rarity: 'rare' },
      { achievementId: 'collector_100', title: { en: 'Star Collector', fr: 'Collectionneur', ar: 'جامع النجوم' }, icon: '✨', category: 'collection', requirement: { type: 'stars', target: 100 }, rewards: { xp: 300, coins: 150 }, rarity: 'epic' },
      { achievementId: 'master_30', title: { en: 'Sudoku Master', fr: 'Maître Sudoku', ar: 'سيد السودوكو' }, icon: '👑', category: 'progress', requirement: { type: 'levels_completed', target: 30 }, rewards: { xp: 500, coins: 250 }, rarity: 'legendary' }
    ];
    await Achievement.insertMany(achievements);
    console.log('   ✓ Created achievements');

    // Seed Shop Items
    console.log('🛒 Creating shop items...');
    const shopItems = [
      { itemId: 'theme_ocean', type: 'theme', name: { en: 'Ocean Blue', fr: 'Bleu Océan', ar: 'أزرق المحيط' }, price: 0, themeData: { primary: '#3b82f6', secondary: '#2563eb', background: ['#0a1628', '#1e3a5f'], accent: '#60a5fa' }, isFeatured: true },
      { itemId: 'theme_sunset', type: 'theme', name: { en: 'Sunset Orange', fr: 'Orange Coucher', ar: 'برتقالي الغروب' }, price: 100, themeData: { primary: '#f97316', secondary: '#ea580c', background: ['#1a0a0a', '#3a1a1a'], accent: '#fb923c' } },
      { itemId: 'theme_purple', type: 'theme', name: { en: 'Royal Purple', fr: 'Violet Royal', ar: 'أرجواني ملكي' }, price: 150, themeData: { primary: '#a855f7', secondary: '#9333ea', background: ['#0f0a1a', '#1f1a3a'], accent: '#c084fc' } },
      { itemId: 'theme_gold', type: 'theme', name: { en: 'Golden', fr: 'Doré', ar: 'ذهبي' }, price: 200, themeData: { primary: '#eab308', secondary: '#ca8a04', background: ['#1a1a0a', '#3a3a1a'], accent: '#fbbf24' } },
      { itemId: 'powerup_hint_5', type: 'powerup', name: { en: '5 Extra Hints', fr: '5 Indices Bonus', ar: '5 تلميحات' }, price: 50, powerupData: { effect: 'hint', quantity: 5 } },
      { itemId: 'powerup_freeze_3', type: 'powerup', name: { en: '3 Time Freeze', fr: '3 Gels du Temps', ar: '3 تجميد' }, price: 75, powerupData: { effect: 'freeze', quantity: 3 } }
    ];
    await ShopItem.insertMany(shopItems);
    console.log('   ✓ Created shop items');

    console.log('\n==================================================');
    console.log('✅ Database seeded successfully!');
    console.log('==================================================');
    console.log('\n📋 Test accounts (passwords from env, or generated above):');
    console.log(`   👑 Admin: admin@sudokusally.com / ${ADMIN_PASSWORD}`);
    console.log(`   👤 User:  test@test.com / ${TEST_PASSWORD}`);
    console.log(`   👤 Demo:  demo@demo.com / ${DEMO_PASSWORD}`);

  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seed();