const express = require('express');
const router = express.Router();
const { startGame, saveGame, completeGame, getHistory } = require('../controllers/gameController');
const auth = require('../middleware/auth');

router.post('/start', auth, startGame);
router.post('/save', auth, saveGame);
router.post('/complete', auth, completeGame);
router.get('/history', auth, getHistory);

module.exports = router;
