const express = require('express');
const router = express.Router();
const { getRotas, addRota, updateRota, deleteRota } = require('./rota.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.get('/', verifyToken, getRotas);
router.post('/', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER'), addRota);
router.put('/:id', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER'), updateRota);
router.delete('/:id', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER'), deleteRota);

module.exports = router;
