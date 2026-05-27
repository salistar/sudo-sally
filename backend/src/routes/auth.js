const express = require('express');
const router = express.Router();
const { register, login, getMe, guestLogin } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/guest', guestLogin);
router.get('/me', auth, getMe);

module.exports = router;
