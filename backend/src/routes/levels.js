const express = require('express');
const router = express.Router();
const Level = require('../models/Level');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all levels
router.get('/', auth, async (req, res) => {
  try {
    const levels = await Level.find({ isActive: true }).sort({ levelNumber: 1 });
    const user = await User.findById(req.user.id);
    
    const levelsWithProgress = levels.map(level => ({
      ...level.toObject(),
      completed: user.completedLevels.includes(level.levelNumber),
      locked: level.levelNumber > user.currentLevel && !user.completedLevels.includes(level.levelNumber - 1)
    }));
    
    res.json({ success: true, levels: levelsWithProgress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific level
router.get('/:id', auth, async (req, res) => {
  try {
    const level = await Level.findOne({ levelNumber: parseInt(req.params.id) });
    if (!level) return res.status(404).json({ error: 'Level not found' });
    res.json({ success: true, level });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
