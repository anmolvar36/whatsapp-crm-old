const express = require('express');
const router = express.Router();
const { getSubscriptions, upgradePlan, suspendClient, addSubscription, getInvoice, updatePaymentMethod } = require('./billing.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER'));

router.get('/', getSubscriptions);
router.post('/', addSubscription);
router.put('/:id/upgrade', upgradePlan);
router.put('/:id/suspend', suspendClient);
router.get('/invoice/:id', getInvoice);
router.put('/:id/payment-method', updatePaymentMethod);

module.exports = router;
