const express = require('express');
const router = express.Router();
const {
    getLeads, createLead, updateLead, deleteLead,
    exportLeads, assignLead, autoAssignLeads
} = require('./lead.controller');
const { verifyToken, roleGuard, scopeLeads } = require('../../middleware/auth.middleware');
const { checkLeadQuota } = require('../../middleware/quota.middleware');
const { auditLog } = require('../../middleware/audit.middleware');

// All routes require authentication + role scope
router.get('/', verifyToken, scopeLeads, getLeads);
router.post('/', verifyToken, roleGuard('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'MANAGER'), checkLeadQuota, auditLog('CREATE_LEAD', 'leads'), createLead);
router.post('/export', verifyToken, scopeLeads, exportLeads);
router.post('/auto-assign', verifyToken, roleGuard('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'), autoAssignLeads);
router.put('/:id', verifyToken, scopeLeads, updateLead);
router.put('/:id/assign', verifyToken, roleGuard('TEAM_LEADER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), assignLead);
router.delete('/:id', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN'), deleteLead);

const {
    createFollowup,
    completeFollowup,
    rescheduleFollowup,
    cancelFollowup,
    getLeadFollowups
} = require('./followup.controller');

// Follow-up Routes
router.post('/:id/followups', verifyToken, scopeLeads, createFollowup);
router.get('/:id/followups', verifyToken, scopeLeads, getLeadFollowups);
router.put('/:id/followups/:followupId/complete', verifyToken, scopeLeads, completeFollowup);
router.put('/:id/followups/:followupId/reschedule', verifyToken, scopeLeads, rescheduleFollowup);
router.put('/:id/followups/:followupId/cancel', verifyToken, scopeLeads, cancelFollowup);

module.exports = router;
