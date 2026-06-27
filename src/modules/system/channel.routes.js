const express = require('express');
const router = express.Router();
const { getChannels, toggleChannel, addChannel, deleteChannel } = require('./channel.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(roleGuard('SUPER_ADMIN', 'ADMIN'));

router.get('/', getChannels);
router.post('/', addChannel);
router.post('/add', addChannel);
router.put('/:id/toggle', toggleChannel);
router.delete('/:id', deleteChannel);

module.exports = router;
