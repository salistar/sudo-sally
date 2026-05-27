const mongoose = require('mongoose');

const leaderboardEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  period: { type: String, enum: ['all_time', 'weekly', 'monthly', 'daily'], required: true },
  periodKey: { type: String }, // e.g., '2024-W52', '2024-12', '2024-12-22'
  
  // Scores
  stars: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  totalXP: { type: Number, default: 0 },
  avgTime: { type: Number },
  perfectGames: { type: Number, default: 0 },
  
  rank: { type: Number },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
leaderboardEntrySchema.index({ period: 1, periodKey: 1, stars: -1 });
leaderboardEntrySchema.index({ user: 1, period: 1 });

module.exports = mongoose.model('LeaderboardEntry', leaderboardEntrySchema);
