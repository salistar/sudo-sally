const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
  levelNumber: { type: Number, required: true, unique: true },
  difficulty: { 
    type: String, 
    enum: ['beginner', 'easy', 'medium', 'hard', 'expert', 'master'], 
    required: true 
  },
  puzzle: { type: String, required: true },
  solution: { type: String, required: true },
  maxErrors: { type: Number, default: 3 },
  hintsAllowed: { type: Number, default: 3 },
  rewards: {
    xp: { type: Number, default: 10 },
    coins: { type: Number, default: 5 },
    stars: {
      threeStarTime: { type: Number, default: 120 },
      twoStarTime: { type: Number, default: 240 }
    }
  },
  stats: {
    totalAttempts: { type: Number, default: 0 },
    totalCompletions: { type: Number, default: 0 },
    avgTime: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

levelSchema.index({ levelNumber: 1 });

module.exports = mongoose.model('Level', levelSchema);