const express = require('express');
const router = express.Router();
const { register, login, getMe, refresh, resetPassword } = require('./auth.controller');
const { verifyToken } = require('../../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/reset-password', resetPassword);
router.get('/me', verifyToken, getMe);

module.exports = router;
