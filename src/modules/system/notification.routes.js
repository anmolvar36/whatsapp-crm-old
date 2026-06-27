const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead } = require('./notification.controller');
const { verifyToken } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getNotifications);
router.put('/:id/read', markAsRead);

module.exports = router;
