const express = require('express');
const router = express.Router();
const { register, login, getMe, guestLogin, googleAuth,
        forgotPassword, resetPassword, changePassword } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/guest', guestLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', auth, changePassword);
router.get('/me', auth, getMe);

module.exports = router;
