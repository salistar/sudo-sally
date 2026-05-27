const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level: { type: Number, required: true },
  
  // Game state
  status: { type: String, enum: ['playing', 'won', 'lost', 'abandoned'], default: 'playing' },
  currentBoard: { type: String }, // JSON string of current board state
  
  // Progress
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  timeSpent: { type: Number, default: 0 }, // seconds
  
  // Performance
  errors: { type: Number, default: 0 },
  hintsUsed: { type: Number, default: 0 },
  
  // Result
  stars: { type: Number, min: 0, max: 3 },
  xpEarned: { type: Number, default: 0 },
  coinsEarned: { type: Number, default: 0 },
  
  // Daily challenge flag
  isDaily: { type: Boolean, default: false }
});

// Index for faster queries
gameSchema.index({ user: 1, level: 1 });
gameSchema.index({ user: 1, status: 1 });
gameSchema.index({ completedAt: -1 });

module.exports = mongoose.model('Game', gameSchema);
