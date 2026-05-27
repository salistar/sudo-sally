const express = require('express');
const router = express.Router();
const { getGlobal, getWeekly, getUserRank } = require('../controllers/leaderboardController');
const auth = require('../middleware/auth');

router.get('/', getGlobal);
router.get('/weekly', getWeekly);
router.get('/me', auth, getUserRank);

module.exports = router;
