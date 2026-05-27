const Game = require('../models/Game');
const User = require('../models/User');
const Level = require('../models/Level');

// Start a new game
exports.startGame = async (req, res) => {
  try {
    const { levelNumber, isDaily } = req.body;
    
    // Find or create level
    let level = await Level.findOne({ levelNumber });
    
    // Create game session
    const game = await Game.create({
      user: req.user.id,
      level: levelNumber,
      isDaily: isDaily || false
    });
    
    // Update level stats
    if (level) {
      level.stats.totalAttempts++;
      await level.save();
    }
    
    res.status(201).json({ success: true, game });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Save game progress
exports.saveGame = async (req, res) => {
  try {
    const { gameId, currentBoard, timeSpent, errors } = req.body;
    
    const game = await Game.findOne({ _id: gameId, user: req.user.id });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    game.currentBoard = currentBoard;
    game.timeSpent = timeSpent;
    game.errors = errors;
    await game.save();
    
    res.json({ success: true, game });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Complete game
exports.completeGame = async (req, res) => {
  try {
    const { gameId, won, timeSpent, errors, hintsUsed, stars } = req.body;
    
    const game = await Game.findOne({ _id: gameId, user: req.user.id });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    game.status = won ? 'won' : 'lost';
    game.completedAt = new Date();
    game.timeSpent = timeSpent;
    game.errors = errors;
    game.hintsUsed = hintsUsed;
    game.stars = stars;
    
    // Calculate rewards
    if (won) {
      const baseXP = 10 + (game.level * 2);
      const baseCoins = 5 + game.level;
      game.xpEarned = baseXP * stars;
      game.coinsEarned = baseCoins * stars;
      
      // Update user
      const user = await User.findById(req.user.id);
      user.xp += game.xpEarned;
      user.coins += game.coinsEarned;
      user.stars += stars;
      user.stats.gamesPlayed++;
      user.stats.gamesWon++;
      user.stats.totalTime += timeSpent;
      user.stats.hintsUsed += hintsUsed;
      user.stats.currentStreak++;
      user.stats.bestStreak = Math.max(user.stats.bestStreak, user.stats.currentStreak);
      
      if (errors === 0) user.stats.perfectGames++;
      if (!user.completedLevels.includes(game.level)) {
        user.completedLevels.push(game.level);
      }
      
      user.level = user.calculateLevel();
      await user.save();
    } else {
      const user = await User.findById(req.user.id);
      user.stats.gamesPlayed++;
      user.stats.currentStreak = 0;
      await user.save();
    }
    
    await game.save();
    
    res.json({ 
      success: true, 
      game,
      rewards: { xp: game.xpEarned, coins: game.coinsEarned, stars }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get game history
exports.getHistory = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    const games = await Game.find({ user: req.user.id })
      .sort({ startedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Game.countDocuments({ user: req.user.id });
    
    res.json({ success: true, games, total, page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
