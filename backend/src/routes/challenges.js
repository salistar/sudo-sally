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