const Challenge = require('../models/Challenge');
const User = require('../models/User');
const { notifyUser } = require('../services/socketService');

// Generate Sudoku puzzle
function generateSudokuPuzzle(difficulty = 'medium') {
  const base = [
    [5,3,4,6,7,8,9,1,2],
    [6,7,2,1,9,5,3,4,8],
    [1,9,8,3,4,2,5,6,7],
    [8,5,9,7,6,1,4,2,3],
    [4,2,6,8,5,3,7,9,1],
    [7,1,3,9,2,4,8,5,6],
    [9,6,1,5,3,7,2,8,4],
    [2,8,7,4,1,9,6,3,5],
    [3,4,5,2,8,6,1,7,9]
  ];
  
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
  const numMap = {};
  const nums = shuffle([1,2,3,4,5,6,7,8,9]);
  for (let i = 0; i < 9; i++) numMap[i + 1] = nums[i];
  
  const solution = base.map(row => row.map(cell => numMap[cell]));
  const puzzle = solution.map(row => [...row]);
  const removeCounts = { easy: 35, medium: 45, hard: 55 };
  const toRemove = removeCounts[difficulty] || 45;
  
  let removed = 0;
  while (removed < toRemove) {
    const row = Math.floor(Math.random() * 9);
    const col = Math.floor(Math.random() * 9);
    if (puzzle[row][col] !== 0) {
      puzzle[row][col] = 0;
      removed++;
    }
  }
  
  return { puzzle, solution };
}

// Get online users
exports.getOnlineUsers = async (req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const users = await User.find({
      _id: { $ne: req.user.id },
      lastActive: { $gte: fiveMinutesAgo },
      isOnline: true
    })
    .select('username avatar level stars isOnline')
    .sort({ stars: -1 })
    .limit(50);
    
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Send challenge
exports.sendChallenge = async (req, res) => {
  try {
    const { targetUserId, targetUsername, difficulty } = req.body;

    // Accept either targetUserId (legacy) OR targetUsername (lobby search).
    let targetUser;
    if (targetUsername) {
      targetUser = await User.findOne({
        username: { $regex: '^' + targetUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' },
      });
      if (!targetUser) return res.status(404).json({ error: 'User not found' });
      if (String(targetUser._id) === String(req.user.id)) {
        return res.status(400).json({ error: 'Cannot challenge yourself' });
      }
    } else {
      if (targetUserId === req.user.id) {
        return res.status(400).json({ error: 'Cannot challenge yourself' });
      }
      targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
    }
    const resolvedTargetId = targetUser._id;
    
    const existingChallenge = await Challenge.findOne({
      $or: [
        { challenger: req.user.id, challenged: resolvedTargetId },
        { challenger: resolvedTargetId, challenged: req.user.id }
      ],
      status: { $in: ['pending', 'accepted', 'playing'] }
    });

    if (existingChallenge) {
      return res.status(400).json({ error: 'A challenge already exists with this user' });
    }

    const { puzzle, solution } = generateSudokuPuzzle(difficulty || 'medium');

    const challenge = await Challenge.create({
      challenger: req.user.id,
      challenged: resolvedTargetId,
      puzzle: JSON.stringify(puzzle),
      solution: JSON.stringify(solution),
      difficulty: difficulty || 'medium',
      challengerProgress: { board: JSON.stringify(puzzle) },
      challengedProgress: { board: JSON.stringify(puzzle) }
    });
    
    await challenge.populate([
      { path: 'challenger', select: 'username avatar level stars' },
      { path: 'challenged', select: 'username avatar level stars' }
    ]);

    // Push real-time notification to the challenged user. Payload mirrors the
    // shape the socketService emits for legacy `challenge:send` (challengerName
    // / challengerAvatar / challengerLevel) — the mobile modal reads those
    // exact keys, so the populated `challenger` object alone produced
    // "undefined veut te défier" before. Both shapes are included so any
    // newer client that reads `challenger` directly still works.
    const ch = challenge.challenger || {};
    notifyUser(resolvedTargetId, 'challenge:received', {
      challengeId: challenge._id,
      odcChallengerId: String(ch._id || req.user.id),
      challengerName: ch.username,
      challengerAvatar: ch.avatar,
      challengerLevel: ch.level,
      challengerStars: ch.stars,
      challenger: challenge.challenger,
      difficulty: challenge.difficulty,
      createdAt: challenge.createdAt
    });

    res.status(201).json({ success: true, challenge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get my challenges
exports.getMyChallenges = async (req, res) => {
  try {
    const sentChallenges = await Challenge.find({
      challenger: req.user.id,
      status: 'pending'
    })
    .populate('challenged', 'username avatar level stars')
    .sort({ createdAt: -1 });
    
    const receivedChallenges = await Challenge.find({
      challenged: req.user.id,
      status: 'pending'
    })
    .populate('challenger', 'username avatar level stars')
    .sort({ createdAt: -1 });
    
    const activeChallenges = await Challenge.find({
      $or: [
        { challenger: req.user.id },
        { challenged: req.user.id }
      ],
      status: 'playing'
    })
    .populate('challenger', 'username avatar level stars')
    .populate('challenged', 'username avatar level stars')
    .sort({ startedAt: -1 });
    
    const history = await Challenge.find({
      $or: [
        { challenger: req.user.id },
        { challenged: req.user.id }
      ],
      status: 'completed'
    })
    .populate('challenger', 'username avatar level stars')
    .populate('challenged', 'username avatar level stars')
    .populate('winner', 'username avatar')
    .sort({ completedAt: -1 })
    .limit(20);
    
    res.json({
      success: true,
      sent: sentChallenges,
      received: receivedChallenges,
      active: activeChallenges,
      history
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Accept challenge
exports.acceptChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findOne({
      _id: challengeId,
      challenged: req.user.id,
      status: 'pending'
    });
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found or already processed' });
    }
    
    challenge.status = 'accepted';
    challenge.acceptedAt = new Date();
    // Extend TTL so the Mongo TTL index doesn't auto-delete the doc 5 minutes
    // after creation — the 5-min default is for unanswered pending challenges;
    // accepted/playing games need room (30 min) to actually be played.
    challenge.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await challenge.save();

    await challenge.populate([
      { path: 'challenger', select: 'username avatar level stars' },
      { path: 'challenged', select: 'username avatar level stars' }
    ]);

    res.json({ success: true, challenge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Decline challenge
exports.declineChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findOne({
      _id: challengeId,
      challenged: req.user.id,
      status: 'pending'
    });
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    challenge.status = 'declined';
    await challenge.save();
    
    res.json({ success: true, message: 'Challenge declined' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Start challenge
exports.startChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findOne({
      _id: challengeId,
      status: 'accepted',
      $or: [
        { challenger: req.user.id },
        { challenged: req.user.id }
      ]
    });
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found or not accepted' });
    }
    
    challenge.status = 'playing';
    challenge.startedAt = new Date();
    // Reset TTL when actually playing so the game doesn't get TTL-evicted
    // mid-match. Defensive even if acceptChallenge already pushed it forward —
    // direct /start calls (web bypasses /accept on auto-accepted flows) need
    // the same protection.
    challenge.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await challenge.save();

    await challenge.populate([
      { path: 'challenger', select: 'username avatar level stars' },
      { path: 'challenged', select: 'username avatar level stars' }
    ]);

    res.json({ success: true, challenge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get challenge
exports.getChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findOne({
      _id: challengeId,
      $or: [
        { challenger: req.user.id },
        { challenged: req.user.id }
      ]
    })
    .populate('challenger', 'username avatar level stars')
    .populate('challenged', 'username avatar level stars')
    .populate('winner', 'username avatar');
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    res.json({ success: true, challenge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update progress
exports.updateProgress = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { board, timeSpent, errors } = req.body;
    
    const challenge = await Challenge.findOne({
      _id: challengeId,
      status: 'playing',
      $or: [
        { challenger: req.user.id },
        { challenged: req.user.id }
      ]
    });
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found or not in progress' });
    }
    
    const isChallenger = challenge.challenger.toString() === req.user.id;
    const progressKey = isChallenger ? 'challengerProgress' : 'challengedProgress';
    
    challenge[progressKey].board = board;
    challenge[progressKey].timeSpent = timeSpent;
    challenge[progressKey].errors = errors;
    
    await challenge.save();
    
    res.json({ success: true, message: 'Progress updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Complete challenge
exports.completeChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { board, timeSpent, errors } = req.body;
    
    const challenge = await Challenge.findOne({
      _id: challengeId,
      status: 'playing',
      $or: [
        { challenger: req.user.id },
        { challenged: req.user.id }
      ]
    });
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found or not in progress' });
    }
    
    const isChallenger = challenge.challenger.toString() === req.user.id;
    const progressKey = isChallenger ? 'challengerProgress' : 'challengedProgress';
    const opponentKey = isChallenger ? 'challengedProgress' : 'challengerProgress';
    
    challenge[progressKey].board = board;
    challenge[progressKey].timeSpent = timeSpent;
    challenge[progressKey].errors = errors;
    challenge[progressKey].completed = true;
    challenge[progressKey].completedAt = new Date();
    
    if (challenge[opponentKey].completed || challenge[opponentKey].abandoned) {
      await determineWinner(challenge);
    }
    
    await challenge.save();
    
    await challenge.populate([
      { path: 'challenger', select: 'username avatar level stars' },
      { path: 'challenged', select: 'username avatar level stars' },
      { path: 'winner', select: 'username avatar' }
    ]);
    
    res.json({ success: true, challenge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Abandon challenge
exports.abandonChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findOne({
      _id: challengeId,
      status: 'playing',
      $or: [
        { challenger: req.user.id },
        { challenged: req.user.id }
      ]
    });
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found or not in progress' });
    }
    
    const isChallenger = challenge.challenger.toString() === req.user.id;
    const progressKey = isChallenger ? 'challengerProgress' : 'challengedProgress';
    
    challenge[progressKey].abandoned = true;
    challenge[progressKey].board = challenge.solution;
    
    const winnerId = isChallenger ? challenge.challenged : challenge.challenger;
    challenge.winner = winnerId;
    challenge.loser = req.user.id;
    challenge.status = 'completed';
    challenge.completedAt = new Date();
    
    await challenge.save();
    await updateUserStats(challenge);
    
    await challenge.populate([
      { path: 'challenger', select: 'username avatar level stars' },
      { path: 'challenged', select: 'username avatar level stars' },
      { path: 'winner', select: 'username avatar' }
    ]);
    
    res.json({ success: true, challenge, message: 'Challenge abandoned' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cancel challenge
exports.cancelChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findOne({
      _id: challengeId,
      challenger: req.user.id,
      status: 'pending'
    });
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found or cannot be cancelled' });
    }
    
    challenge.status = 'cancelled';
    await challenge.save();
    
    res.json({ success: true, message: 'Challenge cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get challenge stats
exports.getChallengeStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [won, lost, total] = await Promise.all([
      Challenge.countDocuments({ winner: userId, status: 'completed' }),
      Challenge.countDocuments({ loser: userId, status: 'completed' }),
      Challenge.countDocuments({
        $or: [{ challenger: userId }, { challenged: userId }],
        status: 'completed'
      })
    ]);
    
    res.json({
      success: true,
      stats: {
        challengesWon: won,
        challengesLost: lost,
        totalChallenges: total,
        winRate: total > 0 ? Math.round((won / total) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper: Determine winner
async function determineWinner(challenge) {
  const cp = challenge.challengerProgress;
  const cdp = challenge.challengedProgress;
  
  if (cp.abandoned && !cdp.abandoned) {
    challenge.winner = challenge.challenged;
    challenge.loser = challenge.challenger;
  } else if (cdp.abandoned && !cp.abandoned) {
    challenge.winner = challenge.challenger;
    challenge.loser = challenge.challenged;
  } else if (cp.abandoned && cdp.abandoned) {
    challenge.isDraw = true;
  } else {
    const challengerScore = cp.timeSpent + (cp.errors * 30);
    const challengedScore = cdp.timeSpent + (cdp.errors * 30);
    
    if (challengerScore < challengedScore) {
      challenge.winner = challenge.challenger;
      challenge.loser = challenge.challenged;
    } else if (challengedScore < challengerScore) {
      challenge.winner = challenge.challenged;
      challenge.loser = challenge.challenger;
    } else {
      challenge.isDraw = true;
    }
  }
  
  challenge.status = 'completed';
  challenge.completedAt = new Date();
  
  await updateUserStats(challenge);
}

// Helper: Update user stats
async function updateUserStats(challenge) {
  if (challenge.isDraw) {
    await User.findByIdAndUpdate(challenge.challenger, {
      $inc: { xp: 30, coins: 15 }
    });
    await User.findByIdAndUpdate(challenge.challenged, {
      $inc: { xp: 30, coins: 15 }
    });
  } else if (challenge.winner && challenge.loser) {
    await User.findByIdAndUpdate(challenge.winner, {
      $inc: { 
        xp: challenge.rewards.winnerXP, 
        coins: challenge.rewards.winnerCoins,
        stars: 3,
        'stats.challengesWon': 1
      }
    });
    
    await User.findByIdAndUpdate(challenge.loser, {
      $inc: { 
        xp: challenge.rewards.loserXP, 
        coins: challenge.rewards.loserCoins,
        'stats.challengesLost': 1
      }
    });
  }
}