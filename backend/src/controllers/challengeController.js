const Challenge = require('../models/Challenge');
const User = require('../models/User');
const { notifyUser } = require('../services/socketService');
const escapeRegex = require('../utils/escapeRegex');

// v3.11.16 — Reconstruct the per-move log for the replay viewer by diffing the
// newly-submitted board against the last stored one. The client only ever sends
// the full board (JSON 2D array) on each progress/complete call, so we derive
// the chronological moves server-side. Fully defensive: any parse/shape error
// is swallowed so move-recording can never block the actual progress save.
// `moves` is capped at 500 (matches the schema comment) to bound document size.
function recordMoves(challenge, progressKey, newBoardStr) {
  try {
    const prog = challenge[progressKey];
    if (!prog || !newBoardStr) return;
    const moves = prog.moves || [];
    if (moves.length >= 500) return;
    const newGrid = typeof newBoardStr === 'string' ? JSON.parse(newBoardStr) : newBoardStr;
    if (!Array.isArray(newGrid)) return;
    const prevGrid = prog.board
      ? (typeof prog.board === 'string' ? JSON.parse(prog.board) : prog.board)
      : null;
    // puzzle/solution are stored as JSON 2D arrays — parse them and index by
    // [row][col]. (Bug M3: the old code did String(...)[cell], indexing the JSON
    // TEXT — so given-cell skipping and the err flag were computed against `[`,
    // `,`, digits of the JSON, producing garbage replay move data.)
    let puzzleGrid = null, solGrid = null;
    try { puzzleGrid = JSON.parse(challenge.puzzle); } catch (_) {}
    try { solGrid = JSON.parse(challenge.solution); } catch (_) {}
    const startedAt = challenge.startedAt ? new Date(challenge.startedAt).getTime() : Date.now();
    const t = Math.max(0, Date.now() - startedAt);
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = row * 9 + col;
        const given = puzzleGrid ? (Number(puzzleGrid[row]?.[col]) || 0) : 0;
        if (given !== 0) continue;                           // skip given cells
        const newVal = Number(newGrid[row]?.[col]) || 0;
        const prevVal = prevGrid ? (Number(prevGrid[row]?.[col]) || 0) : 0;
        if (newVal === prevVal) continue;                   // no change here
        const solVal = solGrid ? (Number(solGrid[row]?.[col]) || 0) : 0;
        moves.push({ cell, value: newVal, t, err: newVal !== 0 && newVal !== solVal });
        if (moves.length >= 500) { prog.moves = moves; return; }
      }
    }
    prog.moves = moves;
  } catch (_) { /* never block the save on move-recording failure */ }
}

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
    const selfId = req.user._id;

    let users = await User.find({
      _id: { $ne: selfId },
      lastActive: { $gte: fiveMinutesAgo },
      isOnline: true
    })
    .select('username avatar level stars isOnline')
    .sort({ stars: -1 })
    .limit(50);

    // Defensive: never leak self into the "online" list even if the $ne
    // comparison silently misses (e.g. legacy docs with string _id).
    const selfStr = String(selfId);
    users = users.filter(u => String(u._id) !== selfStr);

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
        username: { $regex: '^' + escapeRegex(targetUsername) + '$', $options: 'i' },
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

    // UGC moderation: refuse the challenge if a block exists in either direction.
    // (blockedUsers is select:false but is still queryable in a filter.)
    const blockExists = await User.exists({
      $or: [
        { _id: req.user.id, blockedUsers: resolvedTargetId },
        { _id: resolvedTargetId, blockedUsers: req.user.id },
      ],
    });
    if (blockExists) {
      return res.status(403).json({ error: 'Cannot challenge — a block is in place' });
    }

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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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

    // Clamp client-supplied counters — a tampered client could send negative
    // timeSpent/errors to win the both-completed score tiebreak (time + errors*30).
    const safeTime = Math.max(0, Math.floor(Number(timeSpent) || 0));
    const safeErrors = Math.max(0, Math.floor(Number(errors) || 0));
    recordMoves(challenge, progressKey, board);   // diff BEFORE overwriting board
    challenge[progressKey].board = board;
    challenge[progressKey].timeSpent = safeTime;
    challenge[progressKey].errors = safeErrors;

    await challenge.save();

    res.json({ success: true, message: 'Progress updated' });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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

    recordMoves(challenge, progressKey, board);   // capture the final placements

    // Clamp counters (anti-tamper — negative time/errors would win the tiebreak).
    const safeTime = Math.max(0, Math.floor(Number(timeSpent) || 0));
    const safeErrors = Math.max(0, Math.floor(Number(errors) || 0));

    // Persist THIS player's progress atomically (scoped to their own sub-doc),
    // so it records regardless of who wins the settle race below.
    await Challenge.updateOne({ _id: challengeId }, { $set: {
      [`${progressKey}.board`]: board,
      [`${progressKey}.timeSpent`]: safeTime,
      [`${progressKey}.errors`]: safeErrors,
      [`${progressKey}.completed`]: true,
      [`${progressKey}.completedAt`]: new Date(),
      [`${progressKey}.moves`]: challenge[progressKey].moves,
    } });
    // Keep the in-memory doc consistent for determineWinner's decision.
    challenge[progressKey].board = board;
    challenge[progressKey].timeSpent = safeTime;
    challenge[progressKey].errors = safeErrors;
    challenge[progressKey].completed = true;

    // First player to complete a valid board wins the speed duel — settle the
    // match NOW (don't wait for the opponent, who may never finish). The
    // opponent is told via 'challenge:finished'→'challenge:result' and freezes.
    // determineWinner's atomic playing→completed claim is the SINGLE source of
    // truth; we do NOT full-doc save() afterwards (that re-persisted this
    // caller's in-memory winner even when it LOST the race → clobber, bug C2).
    await determineWinner(challenge);

    // Re-read the authoritative settled doc for the response + activity feed.
    const settled = await Challenge.findById(challengeId).populate([
      { path: 'challenger', select: 'username avatar level stars' },
      { path: 'challenged', select: 'username avatar level stars' },
      { path: 'winner', select: 'username avatar' }
    ]);

    // Notify BOTH players of the settled result SERVER-SIDE so the opponent's
    // duel screen shows the win/lose result reliably — even if the completing
    // client never emits the socket 'challenge:finished' relay (a slow / headless
    // / crashed client previously left the opponent stuck on "playing").
    try {
      if (settled.status === 'completed') {
        const payload = {
          challengeId: String(settled._id),
          winner: settled.winner ? String(settled.winner._id) : null,
          loser: settled.loser ? String(settled.loser) : null,
          isDraw: !!settled.isDraw,
          finishedAt: settled.completedAt || new Date(),
        };
        notifyUser(String(settled.challenger?._id || settled.challenger), 'challenge:result', payload);
        notifyUser(String(settled.challenged?._id || settled.challenged), 'challenge:result', payload);
      }
    } catch (_) { /* best-effort opponent notification */ }

    // Global activity feed: sanitized "match finished" broadcast. No board/solution.
    try {
      const { broadcast } = require('../services/socketService');
      broadcast('activity:completed', {
        challenger: { username: settled.challenger?.username, avatar: settled.challenger?.avatar },
        challenged: { username: settled.challenged?.username, avatar: settled.challenged?.avatar },
        winner: settled.winner ? { username: settled.winner.username, avatar: settled.winner.avatar } : null,
        isDraw: !!settled.isDraw,
        difficulty: settled.difficulty,
        at: Date.now(),
      });
    } catch (_) { /* feed broadcast is best-effort */ }

    res.json({ success: true, challenge: settled });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    const winnerId = isChallenger ? challenge.challenged : challenge.challenger;

    // ATOMIC settle (mirrors determineWinner): flip playing→completed in ONE op.
    // The old code did a non-atomic findOne + save + unconditional
    // updateUserStats — so a concurrent completeChallenge that already settled
    // the match would be double-awarded AND have its winner overwritten by the
    // abandon. Only the request that wins this claim credits stats.
    const claimed = await Challenge.findOneAndUpdate(
      { _id: challengeId, status: 'playing' },
      { $set: {
          status: 'completed',
          completedAt: new Date(),
          winner: winnerId,
          loser: req.user.id,
          [`${progressKey}.abandoned`]: true,
          [`${progressKey}.board`]: challenge.solution,
        } },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({ error: 'Challenge already settled' });
    }
    await updateUserStats(claimed);

    await claimed.populate([
      { path: 'challenger', select: 'username avatar level stars' },
      { path: 'challenged', select: 'username avatar level stars' },
      { path: 'winner', select: 'username avatar' }
    ]);

    res.json({ success: true, challenge: claimed, message: 'Challenge abandoned' });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
  } else if (cp.completed && !cdp.completed) {
    // First to complete a valid board wins the speed duel: the challenger
    // finished while the challenged has neither finished nor abandoned.
    challenge.winner = challenge.challenger;
    challenge.loser = challenge.challenged;
  } else if (cdp.completed && !cp.completed) {
    challenge.winner = challenge.challenged;
    challenge.loser = challenge.challenger;
  } else {
    // Both completed (rare near-simultaneous tie) → fastest score wins.
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
  
  // Atomic claim: when both players finish near-simultaneously, two concurrent
  // completeChallenge calls can both reach here and double-credit XP/coins/stars.
  // Flip status playing→completed in a single atomic op; only the winner of that
  // race (claimed !== null) runs updateUserStats. Idempotent for the loser.
  const completedAt = new Date();
  const claimed = await Challenge.findOneAndUpdate(
    { _id: challenge._id, status: 'playing' },
    { $set: { status: 'completed', completedAt, winner: challenge.winner, loser: challenge.loser, isDraw: challenge.isDraw } }
  );
  challenge.status = 'completed';
  challenge.completedAt = completedAt;
  if (!claimed) return;   // already settled by a concurrent call — don't re-award
  await updateUserStats(challenge);
}

// Helper: Update user stats
async function updateUserStats(challenge) {
  // Every settled match counts toward stats.challengesPlayed for BOTH players
  // (was never incremented → the 'challenges_played' achievement was unwinnable
  // and draws advanced no counter).
  if (challenge.isDraw) {
    await User.findByIdAndUpdate(challenge.challenger, {
      $inc: { xp: 30, coins: 15, 'stats.challengesPlayed': 1 }
    });
    await User.findByIdAndUpdate(challenge.challenged, {
      $inc: { xp: 30, coins: 15, 'stats.challengesPlayed': 1 }
    });
  } else if (challenge.winner && challenge.loser) {
    const rw = challenge.rewards || {};
    await User.findByIdAndUpdate(challenge.winner, {
      $inc: {
        xp: rw.winnerXP ?? 100,
        coins: rw.winnerCoins ?? 50,
        stars: 3,
        'stats.challengesWon': 1,
        'stats.challengesPlayed': 1
      }
    });

    await User.findByIdAndUpdate(challenge.loser, {
      $inc: {
        xp: rw.loserXP ?? 20,
        coins: rw.loserCoins ?? 5,
        'stats.challengesLost': 1,
        'stats.challengesPlayed': 1
      }
    });
  }
}
// Test-only export hatch: expose pure helpers for unit testing (no public surface change).
if (process.env.NODE_ENV === 'test') {
  module.exports._test = { generateSudokuPuzzle, recordMoves, determineWinner };
}
