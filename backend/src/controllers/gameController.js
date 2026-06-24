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

    // Load once to validate ownership + read level/isDaily for reward math.
    const existing = await Game.findOne({ _id: gameId, user: req.user.id });
    if (!existing) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Sanitize client-supplied numbers so a tampered request can't grant
    // absurd rewards (e.g. stars:999). stars is clamped 0-3.
    const safeStars  = Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));
    const safeTime   = Math.max(0, Math.floor(Number(timeSpent) || 0));
    const safeErrors = Math.max(0, Math.floor(Number(errors) || 0));
    const safeHints  = Math.max(0, Math.floor(Number(hintsUsed) || 0));

    // A win is only honored when the client submits a board that is a complete,
    // valid Sudoku. Older clients that send no board fall back to the `won` flag.
    const reallyWon = board != null ? (!!won && isCompleteValidSudoku(board)) : !!won;

    // A legitimate win NEVER grants 0 reward — floor the star multiplier at 1.
    const baseXP = 10 + (existing.level * 2);
    const baseCoins = 5 + existing.level;
    const starMult = Math.max(1, safeStars);
    const xpEarned = reallyWon ? baseXP * starMult : 0;
    const coinsEarned = reallyWon ? baseCoins * starMult : 0;

    // IDEMPOTENT + ATOMIC: only the FIRST completion (status still 'playing')
    // credits rewards. A double-tap / network retry / concurrent call finds
    // status !== 'playing' → claim returns null → NO re-credit (was an unlimited
    // economy/leaderboard exploit).
    const game = await Game.findOneAndUpdate(
      { _id: gameId, user: req.user.id, status: 'playing' },
      { $set: {
        status: reallyWon ? 'won' : 'lost',
        completedAt: new Date(),
        timeSpent: safeTime,
        errors: safeErrors,
        hintsUsed: safeHints,
        stars: reallyWon ? safeStars : 0,
        xpEarned,
        coinsEarned,
      } },
      { new: true }
    );
    if (!game) {
      // Already settled → return the recorded result, credit nothing again.
      return res.json({
        success: true,
        game: existing,
        alreadyCompleted: true,
        rewards: { xp: existing.xpEarned, coins: existing.coinsEarned, stars: existing.stars },
      });
    }

    // Credit via atomic $inc (no read-modify-write race). Daily games (BUG-7)
    // never touch the solo win-streak or completedLevels.
    const inc = { xp: xpEarned, coins: coinsEarned, 'stats.gamesPlayed': 1 };
    const ops = { $inc: inc };
    if (reallyWon) {
      inc.stars = safeStars;
      inc['stats.gamesWon'] = 1;
      inc['stats.totalTime'] = safeTime;
      inc['stats.hintsUsed'] = safeHints;
      if (safeErrors === 0) inc['stats.perfectGames'] = 1;
      if (!game.isDaily) {
        inc['stats.currentStreak'] = 1;
        ops.$addToSet = { completedLevels: game.level };
      }
    } else if (!game.isDaily) {
      ops.$set = { 'stats.currentStreak': 0 };
    }
    await User.updateOne({ _id: req.user.id }, ops);

    // Recompute derived fields (level + bestStreak) from the post-$inc values via
    // a TARGETED update (never save() the whole doc — that would clobber the $inc).
    const u = await User.findById(req.user.id);
    await User.updateOne({ _id: req.user.id }, { $set: {
      level: u.calculateLevel(),
      'stats.bestStreak': Math.max(u.stats.bestStreak || 0, u.stats.currentStreak || 0),
    } });

    res.json({
      success: true,
      game,
      rewards: { xp: xpEarned, coins: coinsEarned, stars: game.stars }
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
