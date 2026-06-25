const express = require('express');
const router = express.Router();
const DailyChallenge = require('../models/DailyChallenge');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { generateSudoku, isCompleteValidSudoku } = require('../utils/sudoku');

// Get today's challenge
router.get('/', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let challenge = await DailyChallenge.findOne({ date: today });
    
    // Generate a REAL puzzle (was a stub: empty grid + all-1s solution).
    if (!challenge) {
      const difficulty = ['medium', 'hard', 'expert'][new Date().getDay() % 3];
      const { puzzle, solution } = generateSudoku(difficulty);
      challenge = await DailyChallenge.create({
        date: today,
        puzzle: JSON.stringify(puzzle),
        solution: JSON.stringify(solution),
        difficulty,
      });
    }
    
    const user = await User.findById(req.user.id);
    const completed = user.dailyChallenge.lastPlayed?.toISOString().split('T')[0] === today;
    
    res.json({ success: true, challenge, completed, streak: user.dailyChallenge.streak });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// Complete daily challenge
router.post('/complete', auth, async (req, res) => {
  try {
    const { timeSpent, errors, stars, board } = req.body;
    // Anti-farm: a completion MUST carry a complete, valid solved grid. Without
    // this, POST {} farmed XP/coins once per calendar day with no puzzle solved.
    if (!isCompleteValidSudoku(board)) {
      return res.status(400).json({ error: 'A completed, valid Sudoku board is required' });
    }
    const today = new Date().toISOString().split('T')[0];
    
    const user = await User.findById(req.user.id);
    const lastPlayed = user.dailyChallenge.lastPlayed?.toISOString().split('T')[0];
    
    if (lastPlayed === today) {
      return res.status(400).json({ error: 'Already completed today' });
    }
    
    // Update streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = lastPlayed === yesterday.toISOString().split('T')[0];
    
    user.dailyChallenge.lastPlayed = new Date();
    user.dailyChallenge.streak = wasYesterday ? user.dailyChallenge.streak + 1 : 1;
    user.dailyChallenge.bestStreak = Math.max(user.dailyChallenge.bestStreak, user.dailyChallenge.streak);
    
    // Give rewards
    const xpReward = 50 + (user.dailyChallenge.streak * 10);
    const coinsReward = 30 + (user.dailyChallenge.streak * 5);
    user.xp += xpReward;
    user.coins += coinsReward;
    user.level = user.calculateLevel();   // keep level in sync (solo does this too)

    await user.save();
    
    res.json({ 
      success: true, 
      streak: user.dailyChallenge.streak,
      rewards: { xp: xpReward, coins: coinsReward }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

module.exports = router;
