const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  // Players
  challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  challenged: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Game data
  puzzle: { type: String, required: true },
  solution: { type: String, required: true },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'], 
    default: 'medium' 
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'declined', 'playing', 'completed', 'cancelled', 'expired'],
    default: 'pending'
  },
  
  // Player progress
  challengerProgress: {
    board: { type: String },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    errors: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 },
    abandoned: { type: Boolean, default: false },
    // v3.11.16 sprint-21 — chronological move log for the replay viewer.
    // Each move: cell index (0..80), digit (1..9, or 0 to erase), elapsed
    // milliseconds since startedAt, and whether the placement is a known
    // mistake (post-hoc against solution). Capped at 500 per player to
    // bound document size — average 9x9 solve is ~80 moves.
    moves: { type: [{
      cell: { type: Number, required: true },
      value: { type: Number, required: true },
      t: { type: Number, required: true },
      err: { type: Boolean, default: false },
    }], default: [] },
  },

  challengedProgress: {
    board: { type: String },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    errors: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 },
    abandoned: { type: Boolean, default: false },
    moves: { type: [{
      cell: { type: Number, required: true },
      value: { type: Number, required: true },
      t: { type: Number, required: true },
      err: { type: Boolean, default: false },
    }], default: [] },
  },
  
  // Results
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  loser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDraw: { type: Boolean, default: false },
  
  // Rewards
  rewards: {
    winnerXP: { type: Number, default: 100 },
    winnerCoins: { type: Number, default: 50 },
    loserXP: { type: Number, default: 20 },
    loserCoins: { type: Number, default: 5 }
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 5 * 60 * 1000) }
});

// Indexes
challengeSchema.index({ challenger: 1, status: 1 });
challengeSchema.index({ challenged: 1, status: 1 });
challengeSchema.index({ status: 1, createdAt: -1 });
challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Challenge', challengeSchema);
