const express = require('express');
const router = express.Router();
const { getRules, addRule, toggleRule, deleteRule, updateRule } = require('./routing.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);
router.use(roleGuard('SUPER_ADMIN', 'ADMIN'));

router.get('/', getRules);
router.post('/', addRule);
router.post('/create', addRule);
router.put('/:id', updateRule);
router.put('/:id/toggle', toggleRule);
router.delete('/:id', deleteRule);

module.exports = router;
