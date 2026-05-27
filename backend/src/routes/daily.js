const express = require('express');
const router = express.Router();
const DailyChallenge = require('../models/DailyChallenge');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get today's challenge
router.get('/', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let challenge = await DailyChallenge.findOne({ date: today });
    
    // Generate if not exists
    if (!challenge) {
      // In production, this would generate a real puzzle
      challenge = await DailyChallenge.create({
        date: today,
        puzzle: JSON.stringify(generatePuzzle()),
        solution: JSON.stringify(generateSolution()),
        difficulty: ['medium', 'hard', 'expert'][new Date().getDay() % 3]
      });
    }
    
    const user = await User.findById(req.user.id);
    const completed = user.dailyChallenge.lastPlayed?.toISOString().split('T')[0] === today;
    
    res.json({ success: true, challenge, completed, streak: user.dailyChallenge.streak });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions (simplified)
function generatePuzzle() {
  return Array(9).fill(null).map(() => Array(9).fill(null));
}
function generateSolution() {
  return Array(9).fill(null).map(() => Array(9).fill(1));
}

// Complete daily challenge
router.post('/complete', auth, async (req, res) => {
  try {
    const { timeSpent, errors, stars } = req.body;
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
    
    await user.save();
    
    res.json({ 
      success: true, 
      streak: user.dailyChallenge.streak,
      rewards: { xp: xpReward, coins: coinsReward }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
