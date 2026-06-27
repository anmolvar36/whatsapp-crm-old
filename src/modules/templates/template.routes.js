const express = require('express');
const router = express.Router();
const { getTemplates, addTemplate, updateTemplate, deleteTemplate } = require('./template.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.get('/', verifyToken, getTemplates);
router.post('/', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER'), addTemplate);
router.put('/:id', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER'), updateTemplate);
router.delete('/:id', verifyToken, roleGuard('SUPER_ADMIN', 'ADMIN', 'MANAGER'), deleteTemplate);

module.exports = router;
