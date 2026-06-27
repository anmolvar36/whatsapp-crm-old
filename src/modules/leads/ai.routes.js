const express = require('express');
const router = express.Router();
const { scoreLead, scoreAllLeads, getSmartReplies } = require('./ai.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');
const { auditLog } = require('../../middleware/audit.middleware');

// AI Scoring Routes
router.get('/score/:id', verifyToken, roleGuard('ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'), auditLog('AI_SCORE_SINGLE', 'ai'), scoreLead);
router.post('/score-all', verifyToken, roleGuard('ADMIN', 'SUPER_ADMIN'), auditLog('AI_SCORE_ALL', 'ai'), scoreAllLeads);

// Smart Replies
router.get('/smart-replies/:id', verifyToken, getSmartReplies);

module.exports = router;
