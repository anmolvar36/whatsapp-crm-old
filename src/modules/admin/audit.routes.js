const express = require('express');
const router = express.Router();
const { getAuditLogs, exportLogs } = require('./audit.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(roleGuard('SUPER_ADMIN', 'ADMIN'));

router.get('/logs', getAuditLogs);
router.post('/export', exportLogs);

module.exports = router;
