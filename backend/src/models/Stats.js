const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
  type: { type: String, enum: ['global', 'daily'], default: 'global' },
  date: { type: String }, // For daily stats: YYYY-MM-DD
  
  totalUsers: { type: Number, default: 0 },
  totalGames: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  totalTime: { type: Number, default: 0 },
  
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Stats', statsSchema);
