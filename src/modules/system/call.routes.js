const express = require('express');
const router = express.Router();
const { getCalls, logCall } = require('./call.controller');
const { verifyToken } = require('../../middleware/auth.middleware');

router.get('/', verifyToken, getCalls);
router.post('/', verifyToken, logCall);

module.exports = router;
