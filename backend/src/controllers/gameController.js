const Game = require('../models/Game');
const User = require('../models/User');
const Level = require('../models/Level');

// Anti-cheat: a solo Sudoku is generated client-side (the server never holds the
// solution), but a *completed* grid is self-verifiable — every row, column and
// 3x3 box must contain 1-9 exactly once. So we don't need the original puzzle to
// reject a fake win: a client claiming `won` must submit a board that is a valid
// solved grid. Accepts a 9x9 array or an 81-char string.
function isCompleteValidSudoku(board) {
  let grid;
  try {
    if (typeof board === 'string') {
      if (board.length !== 81) return false;
      grid = Array.from({ length: 9 }, (_, r) => board.slice(r * 9, r * 9 + 9).split('').map(Number));
    } else {
      grid = board;
    }
  } catch (_) { return false; }
  if (!Array.isArray(grid) || grid.length !== 9) return false;
  const has123456789 = (nums) => {
    const seen = new Set();
    for (const n of nums) { if (!Number.isInteger(n) || n < 1 || n > 9) return false; seen.add(n); }
    return seen.size === 9;
  };
  for (let r = 0; r < 9; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== 9) return false;
    if (!has123456789(grid[r].map(Number))) return false;            // row
  }
  for (let c = 0; c < 9; c++) {
    if (!has123456789(grid.map(row => Number(row[c])))) return false; // col
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const box = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push(Number(grid[br + r][bc + c]));
      if (!has123456789(box)) return false;                          // 3x3 box
    }
  }
  return true;
}

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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};

// Complete game
exports.completeGame = async (req, res) => {
  try {
    const { gameId, won, timeSpent, errors, hintsUsed, stars, board } = req.body;

    const game = await Game.findOne({ _id: gameId, user: req.user.id });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Sanitize client-supplied numbers so a tampered request can't grant
    // absurd rewards (e.g. stars:999). stars is clamped 0-3.
    const safeStars  = Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));
    const safeTime   = Math.max(0, Math.floor(Number(timeSpent) || 0));
    const safeErrors = Math.max(0, Math.floor(Number(errors) || 0));
    const safeHints  = Math.max(0, Math.floor(Number(hintsUsed) || 0));

    // A win is only honored when the client submits a board that is a complete,
    // valid Sudoku. Older clients that send no board fall back to trusting the
    // `won` flag (but stars/rewards are still clamped above).
    const reallyWon = board != null ? (!!won && isCompleteValidSudoku(board)) : !!won;

    game.status = reallyWon ? 'won' : 'lost';
    game.completedAt = new Date();
    game.timeSpent = safeTime;
    game.errors = safeErrors;
    game.hintsUsed = safeHints;
    game.stars = reallyWon ? safeStars : 0;

    // Calculate rewards
    if (reallyWon) {
      const baseXP = 10 + (game.level * 2);
      const baseCoins = 5 + game.level;
      game.xpEarned = baseXP * safeStars;
      game.coinsEarned = baseCoins * safeStars;

      // Update user
      const user = await User.findById(req.user.id);
      user.xp += game.xpEarned;
      user.coins += game.coinsEarned;
      user.stars += safeStars;
      user.stats.gamesPlayed++;
      user.stats.gamesWon++;
      user.stats.totalTime += safeTime;
      user.stats.hintsUsed += safeHints;
      user.stats.currentStreak++;
      user.stats.bestStreak = Math.max(user.stats.bestStreak, user.stats.currentStreak);

      if (safeErrors === 0) user.stats.perfectGames++;
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
      rewards: { xp: game.xpEarned, coins: game.coinsEarned, stars: game.stars }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};

if (process.env.NODE_ENV === 'test') {
  module.exports._test = { isCompleteValidSudoku };
}
