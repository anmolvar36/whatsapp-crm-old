const express = require('express');
const router = express.Router();
const { getMenus, getMenusByDashboard, createMenu, addSubmenu } = require('./menu.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', getMenus);
router.get('/:dashboard_name', getMenusByDashboard);
router.post('/', roleGuard('SUPER_ADMIN', 'ADMIN'), createMenu);
router.post('/:id/submenus', roleGuard('SUPER_ADMIN', 'ADMIN'), addSubmenu);

module.exports = router;
