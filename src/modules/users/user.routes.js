const express = require('express');
const router = express.Router();
const { getUsers, updateUser, toggleUserStatus, deleteUser } = require('./user.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

// router.use(verifyToken); // REPLACED WITH PER-ROUTE AUTH
// router.use(roleGuard('SUPER_ADMIN', 'ADMIN')); // REPLACED WITH PER-ROUTE AUTH

router.get('/', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'TEAM_LEADER', 'COUNSELOR', 'MANAGER'), getUsers);
router.put('/:id/toggle', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN'), toggleUserStatus); // toggle status
router.put('/:id', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN'), updateUser);
router.delete('/:id', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN'), deleteUser);

module.exports = router;
