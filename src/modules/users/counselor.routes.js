const express = require('express');
const router = express.Router();
const { addNote, getNotes, getAllNotes, updateStage, getDashboard, getLeads, getCalls, logCall, getLeadStory } = require('./counselor.controller');
const { verifyToken } = require('../../middleware/auth.middleware');

router.use(verifyToken);

router.get('/dashboard', getDashboard);
router.get('/leads', getLeads);
router.get('/leads/:id/story', getLeadStory);
router.get('/notes', getAllNotes);
router.get('/notes/:leadId', getNotes);
router.get('/calls', getCalls);
router.post('/calls', logCall);
router.post('/notes', addNote);
router.put('/stage', updateStage);

module.exports = router;
