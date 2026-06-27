const express = require('express');
const router = express.Router();
const { assignLead, createLead, bulkAssign, getDashboard, getNewLeads, getAssignmentList, getAiStatus } = require('./support.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.get('/dashboard', roleGuard('SUPPORT', 'ADMIN', 'SUPER_ADMIN'), getDashboard);
router.get('/leads/queue', roleGuard('SUPPORT', 'ADMIN', 'SUPER_ADMIN'), getNewLeads);
router.get('/assignment-list', roleGuard('SUPPORT', 'ADMIN', 'SUPER_ADMIN'), getAssignmentList);
router.post('/assign', roleGuard('SUPPORT', 'ADMIN', 'SUPER_ADMIN'), assignLead);
router.post('/leads', roleGuard('SUPPORT', 'ADMIN', 'SUPER_ADMIN'), createLead);
router.post('/leads/bulk-assign', roleGuard('SUPPORT', 'ADMIN', 'SUPER_ADMIN'), bulkAssign);
router.get('/ai-status', roleGuard('SUPPORT', 'ADMIN', 'SUPER_ADMIN'), getAiStatus);

module.exports = router;
