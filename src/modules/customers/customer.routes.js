const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer, updateCustomer, deleteCustomer } = require('./customer.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', getCustomers);
router.post('/', roleGuard('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), createCustomer);
router.put('/:id', roleGuard('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), updateCustomer);
router.delete('/:id', roleGuard('SUPER_ADMIN', 'ADMIN'), deleteCustomer);

module.exports = router;
