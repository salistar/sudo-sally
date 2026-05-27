const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  achievementId: { type: String, required: true, unique: true },
  title: {
    en: String,
    fr: String,
    ar: String
  },
  description: {
    en: String,
    fr: String,
    ar: String
  },
  icon: { type: String, required: true },
  category: { type: String, enum: ['progress', 'skill', 'collection', 'social', 'special'], default: 'progress' },
  
  // Requirements
  requirement: {
    type: { type: String }, // 'games_won', 'streak', 'perfect', 'time', 'level', 'stars', etc.
    target: Number
  },
  
  // Rewards
  rewards: {
    xp: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    title: String, // Special title for profile
    theme: String  // Unlock special theme
  },
  
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Achievement', achievementSchema);
