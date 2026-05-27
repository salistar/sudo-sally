const express = require('express');
const router = express.Router();
const Achievement = require('../models/Achievement');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all achievements
router.get('/', async (req, res) => {
  try {
    const achievements = await Achievement.find({ isActive: true });
    res.json({ success: true, achievements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user achievements
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const achievements = await Achievement.find({ isActive: true });
    
    const userAchievements = achievements.map(a => ({
      ...a.toObject(),
      unlocked: user.achievements.some(ua => ua.achievementId === a.achievementId),
      unlockedAt: user.achievements.find(ua => ua.achievementId === a.achievementId)?.unlockedAt
    }));
    
    res.json({ success: true, achievements: userAchievements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unlock achievement
router.post('/:id/unlock', auth, async (req, res) => {
  try {
    const achievement = await Achievement.findOne({ achievementId: req.params.id });
    if (!achievement) return res.status(404).json({ error: 'Achievement not found' });
    
    const user = await User.findById(req.user.id);
    if (user.achievements.some(a => a.achievementId === req.params.id)) {
      return res.status(400).json({ error: 'Already unlocked' });
    }
    
    user.achievements.push({ achievementId: req.params.id, unlockedAt: new Date() });
    user.xp += achievement.rewards.xp || 0;
    user.coins += achievement.rewards.coins || 0;
    await user.save();
    
    res.json({ success: true, achievement, rewards: achievement.rewards });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
