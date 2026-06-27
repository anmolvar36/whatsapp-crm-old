const express = require('express');
const router = express.Router();
const { getGeneratedReport, downloadReport, executeAction, updateWorkingHours, getWorkingHours, getSecuritySettings, updateSecuritySettings, getActiveSessions, revokeSession } = require('./admin.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.get('/reports/generate', roleGuard('ADMIN', 'SUPER_ADMIN'), getGeneratedReport);
router.get('/reports/download', roleGuard('ADMIN', 'SUPER_ADMIN'), downloadReport);
router.post('/execute', roleGuard('ADMIN', 'SUPER_ADMIN'), executeAction);
router.get('/working-hours', roleGuard('ADMIN', 'SUPER_ADMIN'), getWorkingHours);
router.put('/working-hours', roleGuard('ADMIN', 'SUPER_ADMIN'), updateWorkingHours);

// Security
router.get('/security/settings', roleGuard('ADMIN', 'SUPER_ADMIN'), getSecuritySettings);
router.put('/security/settings', roleGuard('ADMIN', 'SUPER_ADMIN'), updateSecuritySettings);
router.get('/security/sessions', roleGuard('ADMIN', 'SUPER_ADMIN'), getActiveSessions);
router.post('/security/sessions/:id/revoke', roleGuard('ADMIN', 'SUPER_ADMIN'), revokeSession);

// Integrations
const { getIntegrations, addIntegration, deleteIntegration, testConnection } = require('./admin.controller');
router.get('/integrations', roleGuard('ADMIN', 'SUPER_ADMIN'), getIntegrations);
router.post('/integrations', roleGuard('ADMIN', 'SUPER_ADMIN'), addIntegration);
router.delete('/integrations/:id', roleGuard('ADMIN', 'SUPER_ADMIN'), deleteIntegration);
router.post('/integrations/:id/test', roleGuard('ADMIN', 'SUPER_ADMIN'), testConnection);

module.exports = router;
