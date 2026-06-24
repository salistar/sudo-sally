const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getOnlineUsers,
  sendChallenge,
  getMyChallenges,
  acceptChallenge,
  declineChallenge,
  startChallenge,
  getChallenge,
  updateProgress,
  completeChallenge,
  abandonChallenge,
  cancelChallenge,
  getChallengeStats
} = require('../controllers/challengeController');

// Get online users to challenge
router.get('/users/online', auth, getOnlineUsers);

// Get all my challenges (sent, received, active, history)
router.get('/my', auth, getMyChallenges);

// Aliases that return one slice of /my — defined BEFORE /:challengeId so the
// param route doesn't eat them as an ObjectId (previously: /pending → 500
// "Cast to ObjectId failed for value pending").
const slice = (key) => async (req, res, next) => {
  res.json = (orig => function (body) {
    if (body && body.success && body[key]) return orig.call(this, { success: true, [key]: body[key] });
    return orig.call(this, body);
  })(res.json);
  return getMyChallenges(req, res, next);
};
router.get('/pending', auth, slice('received'));
router.get('/sent',    auth, slice('sent'));
router.get('/active',  auth, slice('active'));
router.get('/history', auth, slice('history'));

// Get challenge stats
router.get('/stats', auth, getChallengeStats);

// Send a new challenge
router.post('/send', auth, sendChallenge);

// v3.11.16 sprint-21 — replay endpoint. Returns the puzzle, solution,
// difficulty, both move timelines and elapsed times — enough for the
// /replay/[id] page to reconstruct the board frame-by-frame. Public to
// authed players so anyone with a challenge id can watch the replay.
// Declared BEFORE /:challengeId so Express order doesn't shadow it.
const mongoose = require('mongoose');
const Challenge = require('../models/Challenge');
router.get('/:challengeId/replay', auth, async (req, res) => {
  try {
    // Guard a malformed id before it reaches findById (avoids a CastError
    // whose message would echo the bad input back to the caller).
    if (!mongoose.isValidObjectId(req.params.challengeId)) {
      return res.status(404).json({ success: false, error: 'Challenge not found' });
    }
    // Scope to participants AND require the match to be over. Without this:
    //  • any authed user could fetch ANY challenge's replay (IDOR), and
    //  • a player mid-game could read `solution` and win instantly (cheat).
    const c = await Challenge.findOne({
      _id: req.params.challengeId,
      status: 'completed',
      $or: [
        { challenger: req.user.id },
        { challenged: req.user.id },
      ],
    })
      .populate('challenger',  'username avatar')
      .populate('challenged',  'username avatar')
      .populate('winner',      'username avatar');
    if (!c) return res.status(404).json({ success: false, error: 'Challenge not found' });
    res.json({
      success: true,
      replay: {
        challengeId: String(c._id),
        puzzle: c.puzzle,
        solution: c.solution,
        difficulty: c.difficulty,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        challenger: c.challenger,
        challenged: c.challenged,
        winner: c.winner,
        isDraw: !!c.isDraw,
        challengerMoves: (c.challengerProgress?.moves || []),
        challengedMoves: (c.challengedProgress?.moves || []),
        challengerTime:  c.challengerProgress?.timeSpent || 0,
        challengedTime:  c.challengedProgress?.timeSpent || 0,
        challengerErrors: c.challengerProgress?.errors || 0,
        challengedErrors: c.challengedProgress?.errors || 0,
      },
    });
  } catch (error) {
    console.error('[replay]', error);
    res.status(500).json({ success: false, error: 'Failed to load replay' });
  }
});

// LIVE spectate — lets a non-participant watch an ONGOING 1v1 (both boards +
// names + times) for broadcasting. No `solution` is returned, so a spectator
// can never be fed the answer. Realtime board updates arrive via the socket
// 'challenge:spectate' room join. Declared BEFORE /:challengeId.
router.get('/:challengeId/spectate', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.challengeId)) {
      return res.status(404).json({ success: false, error: 'Challenge not found' });
    }
    const c = await Challenge.findById(req.params.challengeId)
      .populate('challenger', 'username avatar')
      .populate('challenged', 'username avatar')
      .populate('winner', 'username avatar');
    if (!c) return res.status(404).json({ success: false, error: 'Challenge not found' });
    // Privacy gate: only a duel both players consented to broadcast may be
    // watched by a non-participant. Participants can always view their own match.
    const uid = String(req.user.id);
    const isParticipant = uid === String(c.challenger?._id || c.challenger) || uid === String(c.challenged?._id || c.challenged);
    if (!isParticipant && !c.broadcast?.consented) {
      return res.status(403).json({ success: false, error: 'This duel is not a public broadcast' });
    }
    res.json({
      success: true,
      spectate: {
        challengeId: String(c._id),
        puzzle: c.puzzle,
        difficulty: c.difficulty,
        status: c.status,
        challenger: c.challenger,
        challenged: c.challenged,
        winner: c.winner,
        challengerId: String(c.challenger?._id || c.challenger),
        challengedId: String(c.challenged?._id || c.challenged),
        challengerBoard: c.challengerProgress?.board || c.puzzle,
        challengedBoard: c.challengedProgress?.board || c.puzzle,
        challengerTime:  c.challengerProgress?.timeSpent || 0,
        challengedTime:  c.challengedProgress?.timeSpent || 0,
        challengerErrors: c.challengerProgress?.errors || 0,
        challengedErrors: c.challengedProgress?.errors || 0,
      },
    });
  } catch (e) {
    console.error('[spectate]', e);
    res.status(500).json({ success: false, error: 'Failed to load spectate' });
  }
});

// sprint-32 — recent completed matches across ALL users. Powers the live
// community feed's initial state; real-time updates arrive via the
// 'activity:completed' socket broadcast. Declared BEFORE /:challengeId.
router.get('/feed/recent', auth, async (req, res) => {
  try {
    const items = await Challenge.find({ status: 'completed' })
      .populate('challenger', 'username avatar')
      .populate('challenged', 'username avatar')
      .populate('winner', 'username avatar')
      .sort({ completedAt: -1 })
      .limit(12);
    res.json({
      success: true,
      feed: items.map((c) => ({
        id: String(c._id),
        challenger: { username: c.challenger?.username, avatar: c.challenger?.avatar },
        challenged: { username: c.challenged?.username, avatar: c.challenged?.avatar },
        winner: c.winner ? { username: c.winner.username, avatar: c.winner.avatar } : null,
        isDraw: !!c.isDraw,
        difficulty: c.difficulty,
        at: c.completedAt,
      })),
    });
  } catch (error) {
    console.error('[feed/recent]', error);
    res.status(500).json({ success: false, error: 'Failed to load feed' });
  }
});

// Get specific challenge
router.get('/:challengeId', auth, getChallenge);

// Accept a challenge
router.post('/:challengeId/accept', auth, acceptChallenge);

// Decline a challenge
router.post('/:challengeId/decline', auth, declineChallenge);

// Start playing a challenge
router.post('/:challengeId/start', auth, startChallenge);

// Update progress during game
router.put('/:challengeId/progress', auth, updateProgress);

// Complete the challenge (player finished)
router.post('/:challengeId/complete', auth, completeChallenge);

// Abandon the challenge
router.post('/:challengeId/abandon', auth, abandonChallenge);

// Cancel a pending challenge
router.delete('/:challengeId', auth, cancelChallenge);

module.exports = router;