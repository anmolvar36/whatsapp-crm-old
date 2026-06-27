const express = require('express');
const router = express.Router();
const {
    getDashboard,
    getLeads,
    updateLeadStatus,
    addTeamNote,
    getPerformance,
    reassignLead,
    getSlaAlerts,
    getInbox,
    getActivityLogs,
    sendReminder,
} = require('./teamleader.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(roleGuard('TEAM_LEADER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/leads', getLeads);
router.get('/reassign-list', getLeads);
router.get('/performance', getPerformance);
router.get('/sla-alerts', getSlaAlerts);
router.get('/inbox', getInbox);
router.get('/activity-logs', getActivityLogs);
router.post('/reminder', sendReminder);

router.put('/leads/:id/reassign', reassignLead);
router.put('/leads/:id/status', updateLeadStatus);
router.post('/notes', addTeamNote);
router.post('/refresh', (req, res) => res.json({ success: true, message: 'Refresh signal processed' }));

module.exports = router;

