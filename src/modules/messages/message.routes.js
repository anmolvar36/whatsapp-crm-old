const express = require('express');
const router = express.Router();
const { getChats, getMessages, sendMessage, clearUnread } = require('./message.controller');
const { verifyToken, scopeLeads } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(scopeLeads);

router.get('/', getChats);
router.get('/:leadId', getMessages);
router.post('/', sendMessage);
router.put('/clear/:chatId', clearUnread);

module.exports = router;
