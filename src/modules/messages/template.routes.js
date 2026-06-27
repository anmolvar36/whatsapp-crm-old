const express = require('express');
const router = express.Router();
const { getTemplates, addTemplate, updateTemplate, deleteTemplate } = require('./template.controller');
const { verifyToken, roleGuard } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', getTemplates);
router.post('/', roleGuard('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), addTemplate);
router.put('/:id', roleGuard('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), updateTemplate);
router.delete('/:id', roleGuard('SUPER_ADMIN', 'ADMIN', 'SUPPORT'), deleteTemplate);

module.exports = router;
