const express = require('express');
const router = express.Router();
const {
    getDashboard,
    getFunnelReport,
    getCountryAnalytics,
    refreshData,
    getSlaMetrics,
    getConversionTracking,
    getTeamOverview,
    getTeamCounselors,
    getCallReports,
    exportReport
} = require('./manager.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(roleGuard('MANAGER', 'ADMIN', 'SUPER_ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/funnel', getFunnelReport);
router.get('/country-analytics', getCountryAnalytics);
router.get('/sla-metrics', getSlaMetrics);
router.get('/conversion-tracking', getConversionTracking);
router.get('/team-overview', getTeamOverview);
router.get('/team-counselors/:teamName', getTeamCounselors);
router.get('/call-reports', getCallReports);
router.post('/refresh', refreshData);
router.get('/export', exportReport);

module.exports = router;

