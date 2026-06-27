const express = require('express');
const router = express.Router();
const { getReportSummary, getReportExport } = require('./report.controller');
const { verifyToken, scopeLeads } = require('../../middleware/auth.middleware');

router.get('/summary', verifyToken, scopeLeads, getReportSummary);
router.get('/export', verifyToken, scopeLeads, getReportExport);

module.exports = router;
