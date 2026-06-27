const express = require('express');
const router = express.Router();
const { toggleClientChannel, deleteClientChannel, dispatchLead, addAdmin, updatePermissions, getAdmins, toggleAdminStatus, getDashboardKpis, getDispatchQueue } = require('./superadmin.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(roleGuard('SUPER_ADMIN'));

router.get('/dashboard/kpis', getDashboardKpis);
router.get('/leads/dispatch-queue', getDispatchQueue);
router.post('/leads/dispatch', dispatchLead);

router.get('/admins', getAdmins);
router.post('/admins', addAdmin);
router.put('/admins/:id/permissions', updatePermissions);
router.put('/admins/:id/toggle', toggleAdminStatus);

// Channel management (Super Admin controls)
router.put('/channels/:id/toggle', toggleClientChannel);
router.delete('/channels/:id', deleteClientChannel);

module.exports = router;
