const mongoose = require('mongoose');

const dailyChallengeSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  puzzle: { type: String, required: true },
  solution: { type: String, required: true },
  difficulty: { type: String, enum: ['medium', 'hard', 'expert'], required: true },
  
  // Rewards
  rewards: {
    xp: { type: Number, default: 50 },
    coins: { type: Number, default: 30 }
  },
  
  // Statistics
  stats: {
    attempts: { type: Number, default: 0 },
    completions: { type: Number, default: 0 },
    avgTime: { type: Number, default: 0 },
    bestTime: { type: Number },
    bestUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DailyChallenge', dailyChallengeSchema);
