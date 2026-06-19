const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Game = require('../models/Game');
const auth = require('../middleware/auth');

// Get global stats
router.get('/', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalGames = await Game.countDocuments();
    const totalWins = await Game.countDocuments({ status: 'won' });
    
    const topPlayer = await User.findOne().sort({ stars: -1 }).select('username stars');
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalGames,
        totalWins,
        winRate: totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0,
        topPlayer
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// Get user stats
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const recentGames = await Game.find({ user: req.user.id })
      .sort({ startedAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      stats: user.stats,
      level: user.level,
      xp: user.xp,
      stars: user.stars,
      recentGames
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

module.exports = router;
