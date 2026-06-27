const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    updateAiConfig,
    getAiConfig,
    getKpiStats,
    getSuperAdminDashboard,
    getAdminDashboard,
    getManagerDashboard,
    getTeamLeaderDashboard,
    getCounselorDashboard,
    getSupportDashboard,
    updateSuperAdminDashboard,
    createSnapshot
} = require('./dashboard.controller');
const { verifyToken, roleGuard, scopeLeads } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(scopeLeads);

router.get('/kpi', verifyToken, getKpiStats);
router.get('/stats', verifyToken, getDashboardStats);

// Role-Based Specific Dashboards
router.get('/superadmin', verifyToken, roleGuard('SUPER_ADMIN'), getSuperAdminDashboard);
router.post('/superadmin/update', verifyToken, roleGuard('SUPER_ADMIN'), updateSuperAdminDashboard);
router.post('/superadmin/snapshot', verifyToken, roleGuard('SUPER_ADMIN'), createSnapshot);
router.get('/admin', verifyToken, roleGuard('ADMIN', 'SUPER_ADMIN'), getAdminDashboard);
router.get('/manager', verifyToken, roleGuard('MANAGER', 'SUPER_ADMIN'), getManagerDashboard);
router.get('/teamleader', verifyToken, roleGuard('TEAM_LEADER', 'SUPER_ADMIN'), getTeamLeaderDashboard);
router.get('/counselor', verifyToken, roleGuard('COUNSELOR', 'SUPER_ADMIN'), getCounselorDashboard);
router.get('/support', verifyToken, roleGuard('SUPPORT', 'SUPER_ADMIN'), getSupportDashboard);

router.get('/ai-config', verifyToken, getAiConfig);
router.post('/ai-config', verifyToken, updateAiConfig);

module.exports = router;
