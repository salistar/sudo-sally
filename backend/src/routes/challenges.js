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