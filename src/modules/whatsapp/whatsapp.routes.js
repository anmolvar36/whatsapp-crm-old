const express = require('express');
const router = express.Router();
const { sendMessage, getLogs } = require('./whatsapp.controller');
const { verifyToken } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.post('/send', sendMessage);
router.get('/logs', getLogs);

module.exports = router;
