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
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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

    // Verify the achievement criteria SERVER-SIDE before granting rewards.
    // Previously the client could name ANY achievementId and mint its coins/XP
    // with zero gameplay (economy fraud). Achievements with no requirement.type
    // (e.g. 'welcome') remain unconditionally unlockable.
    const reqDef = achievement.requirement || {};
    if (reqDef.type) {
      const s = user.stats || {};
      const current = {
        games_won: s.gamesWon, games_played: s.gamesPlayed,
        streak: Math.max(s.currentStreak || 0, s.bestStreak || 0),
        perfect: s.perfectGames, level: user.level, stars: user.stars,
        challenges_won: s.challengesWon, challenges_played: s.challengesPlayed,
        hints_used: s.hintsUsed,
      }[reqDef.type];
      if (current === undefined || current < (reqDef.target || 0)) {
        return res.status(403).json({ error: 'Achievement criteria not met' });
      }
    }

    user.achievements.push({ achievementId: req.params.id, unlockedAt: new Date() });
    user.xp += achievement.rewards.xp || 0;
    user.coins += achievement.rewards.coins || 0;
    await user.save();
    
    res.json({ success: true, achievement, rewards: achievement.rewards });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

module.exports = router;
