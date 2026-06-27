const express = require('express');
const router = express.Router();
const { getSummary, getExport } = require('./analytics.controller');
const { verifyToken, roleGuard, scopeLeads } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(scopeLeads);

router.get('/summary', getSummary);
router.get('/export', getExport);

module.exports = router;

