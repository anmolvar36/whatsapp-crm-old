const prisma = require('../../config/prisma');

// @desc    Add a note to a lead
// @route   POST /api/counselor/notes
exports.addNote = async (req, res, next) => {
    try {
        const { leadId, text, country, stage } = req.body;

        let targetLeadId = parseInt(leadId);
        if (isNaN(targetLeadId)) {
            let targetLead = await prisma.lead.findFirst({
                where: { name: leadId }
            });
            if (!targetLead) {
                targetLead = await prisma.lead.create({
                    data: {
                        name: leadId,
                        stage: stage || 'New',
                        country: country || null,
                        assignedTo: req.user.id
                    }
                });
            }
            targetLeadId = targetLead.id;
        }

        const note = await prisma.counselorNote.create({
            data: {
                leadId: targetLeadId,
                authorId: req.user.id,
                text
            },
            include: {
                author: {
                    select: { name: true }
                }
            }
        });

        const socketManager = require('../../sockets/socketManager');
        socketManager.events.dashboardRefresh({ trigger: 'new_note', leadId: targetLeadId });

        // Log Activity
        await prisma.activity.create({
            data: {
                leadId: targetLeadId,
                userId: req.user.id,
                action: 'Note Added',
                details: text.length > 50 ? `${text.substring(0, 50)}...` : text
            }
        });

        const formattedNote = {
            ...note,
            authorName: note.author.name
        };
        delete formattedNote.author;

        res.status(201).json({ success: true, data: formattedNote });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all notes (for directory)
// @route   GET /api/counselor/notes
exports.getAllNotes = async (req, res, next) => {
    try {
        const { country, status } = req.query;

        const where = {
            lead: { assignedTo: req.user.id }
        };
        
        if (country && country !== 'Global') {
            where.lead.country = country;
        }
        if (status && status !== 'All Stages') {
            where.lead.stage = status;
        }

        const notes = await prisma.counselorNote.findMany({
            where,
            include: {
                lead: { select: { name: true, country: true, stage: true } },
                author: { select: { name: true } }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formattedNotes = notes.map(n => ({
            ...n,
            leadName: n.lead.name,
            authorName: n.author.name
        }));

        res.json({ success: true, data: formattedNotes });
    } catch (error) {
        next(error);
    }
};

// @desc    Get notes for a lead
// @route   GET /api/counselor/notes/:leadId
exports.getNotes = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.leadId);
        const notes = await prisma.counselorNote.findMany({
            where: { leadId },
            include: {
                author: { select: { name: true } }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formattedNotes = notes.map(n => ({
            ...n,
            authorName: n.author.name
        }));

        res.json({ success: true, data: formattedNotes });
    } catch (error) {
        next(error);
    }
};

exports.updateStage = async (req, res, next) => {
    try {
        const { leadId, stage, managerOverride } = req.body;
        const targetLeadId = parseInt(leadId);
        const role = req.user?.roleName || req.user?.role?.name || '';

        // Interaction-Based Conversion Validation
        if (stage && ['Converted', 'Lost'].includes(stage)) {
            const disableValidation = process.env.DISABLE_LEAD_CONVERSION_VALIDATION === 'true';
            if (!disableValidation) {
                const isManagerOrAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(role);
                const hasOverride = managerOverride === true && isManagerOrAdmin;

                if (!hasOverride) {
                    const [messageCount, callCount, followupCount] = await Promise.all([
                        prisma.message.count({
                            where: { leadId: targetLeadId, sender: { notIn: ['lead', 'System'] } }
                        }),
                        prisma.call.count({
                            where: { 
                                leadId: targetLeadId, 
                                outcome: { in: ['Interested', 'Qualified', 'Follow-up', 'Not Interested'] } 
                            }
                        }),
                        prisma.leadFollowup.count({
                            where: { leadId: targetLeadId, status: 'Completed' }
                        })
                    ]);

                    if (messageCount === 0 && callCount === 0 && followupCount === 0) {
                        return res.status(403).json({
                            success: false,
                            message: 'Lead cannot be converted or marked lost without proper interaction history (at least one outgoing message, connected call, or completed follow-up), or manager override.'
                        });
                    }
                }
            }
        }

        const updatedLead = await prisma.lead.update({
            where: { id: targetLeadId },
            data: { stage }
        });

        // Log Activity
        await prisma.activity.create({
            data: {
                leadId: parseInt(leadId),
                userId: req.user.id,
                action: 'Stage Transition',
                details: `Lifecycle updated to ${stage}`
            }
        });

        // Emit real-time updates
        const socketManager = require('../../sockets/socketManager');
        socketManager.events.leadUpdate(updatedLead);
        socketManager.events.dashboardRefresh({ trigger: 'counselor_stage_update', leadId, stage });

        res.json({ success: true, message: 'Stage updated successfully', data: updatedLead });
    } catch (error) {
        next(error);
    }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            assignedLeads, 
            hotLeads, 
            actionPendings, 
            convertedThisMonth,
            todaysFollowups,
            overdueFollowupsList
        ] = await Promise.all([
            prisma.lead.count({ 
                where: { assignedTo: userId, stage: { notIn: ['Converted', 'Lost'] } } 
            }),
            prisma.lead.count({
                where: {
                    assignedTo: userId,
                    stage: { in: ['Qualified', 'Contacted', 'Pending'] }
                }
            }),
            prisma.leadFollowup.count({
                where: { counselorId: userId, status: 'Pending' }
            }),
            prisma.lead.count({
                where: {
                    assignedTo: userId,
                    stage: 'Converted',
                    updatedAt: { gte: startOfMonth }
                }
            }),
            prisma.leadFollowup.findMany({
                where: {
                    counselorId: userId,
                    scheduledTime: { gte: startOfDay, lte: endOfDay },
                    status: { notIn: ['Cancelled', 'Completed'] }
                },
                include: { lead: { select: { id: true, name: true } } },
                orderBy: { scheduledTime: 'asc' }
            }),
            prisma.leadFollowup.findMany({
                where: {
                    counselorId: userId,
                    scheduledTime: { lt: now },
                    status: { notIn: ['Cancelled', 'Completed'] }
                },
                include: { lead: { select: { id: true, name: true } } },
                orderBy: { scheduledTime: 'asc' }
            })
        ]);

        res.json({
            success: true,
            data: { 
                assignedLeads, 
                hotLeads, 
                actionPendings,
                convertedThisMonth,
                todaysFollowups: todaysFollowups.map(f => ({ ...f, isOverdue: new Date(f.scheduledTime) < now })),
                overdueFollowups: overdueFollowupsList.map(f => ({ ...f, isOverdue: true }))
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get counselor leads
// @route   GET /api/counselor/leads
exports.getLeads = async (req, res, next) => {
    try {
        const leads = await prisma.lead.findMany({
            where: { assignedTo: req.user.id },
            orderBy: {
                updatedAt: 'desc'
            }
        });
        res.json({ success: true, data: leads });
    } catch (error) {
        next(error);
    }
};

// @desc    Get counselor calls
// @route   GET /api/counselor/calls
exports.getCalls = async (req, res, next) => {
    try {
        const calls = await prisma.call.findMany({
            where: { counselorId: req.user.id },
            orderBy: { date: 'desc' }
        });
        res.json({ success: true, data: calls });
    } catch (error) {
        next(error);
    }
};

// @desc    Log a new call
// @route   POST /api/counselor/calls
exports.logCall = async (req, res, next) => {
    try {
        const { lead, type, duration, outcome, notes, date, time } = req.body;

        let leadId = parseInt(lead);
        if (isNaN(leadId)) {
            // If lead is a string name, resolve it to an ID
            let targetLead = await prisma.lead.findFirst({
                where: { name: lead }
            });

            if (!targetLead) {
                // Auto-create lead if not found to allow smooth logging
                targetLead = await prisma.lead.create({
                    data: {
                        name: lead,
                        stage: outcome === 'Qualified' ? 'Qualified' : (outcome === 'Interested' ? 'Qualified' : 'New'),
                        assignedTo: req.user.id
                    }
                });
            }
            leadId = targetLead.id;
        }

        const call = await prisma.call.create({
            data: {
                leadId: leadId,
                type,
                duration: parseInt(duration) || 0,
                outcome,
                callStatus: outcome || 'Pending',
                notes,
                date: date || new Date().toISOString(),
                time: time || '00:00',
                counselorId: req.user.id
            }
        });

        // Log Activity
        await prisma.activity.create({
            data: {
                leadId: leadId,
                userId: req.user.id,
                action: 'Call Logged',
                details: `${type} Call - ${outcome}`
            }
        });

        res.status(201).json({ success: true, data: call });
    } catch (error) {
        next(error);
    }
};
// @desc    Get story for a lead
// @route   GET /api/counselor/leads/:id/story
exports.getLeadStory = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const [activities, notes, calls, assignmentHistory, followups] = await Promise.all([
            prisma.activity.findMany({
                where: { leadId },
                include: { user: { select: { name: true } } },
                orderBy: { timestamp: 'desc' }
            }),
            prisma.counselorNote.findMany({
                where: { leadId },
                include: { author: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.call.findMany({
                where: { leadId },
                include: { counselor: { select: { name: true } } },
                orderBy: { date: 'desc' }
            }),
            prisma.leadAssignmentHistory.findMany({
                where: { leadId },
                include: {
                    assignedBy: { select: { name: true } },
                    assignedTo: { select: { name: true } },
                    previousOwner: { select: { name: true } }
                },
                orderBy: { assignedAt: 'desc' }
            }),
            prisma.leadFollowup.findMany({
                where: { leadId },
                include: { counselor: { select: { name: true } } },
                orderBy: { scheduledTime: 'desc' }
            })
        ]);

        // Merge and sort all activities into a single chronological story
        const story = [
            ...activities.map(a => {
                if (a.action === 'ACADEMIC_PROFILE_UPDATED') {
                    return {
                        id: `act-${a.id}`,
                        type: 'AcademicProfile',
                        action: 'Academic Profile Updated',
                        details: a.details,
                        timestamp: a.timestamp,
                        user: a.user?.name || 'System'
                    };
                }
                return {
                    id: `act-${a.id}`,
                    type: 'Activity',
                    action: a.action,
                    details: a.details,
                    timestamp: a.timestamp,
                    user: a.user?.name || 'System'
                };
            }),
            ...notes.map(n => ({
                id: `note-${n.id}`,
                type: 'Note',
                action: 'Note Added',
                details: n.text,
                timestamp: n.createdAt,
                user: n.author?.name
            })),
            ...calls.map(c => ({
                id: `call-${c.id}`,
                type: 'Call',
                action: `${c.type} Call`,
                details: `${c.outcome}: ${c.notes || 'No notes'}`,
                timestamp: new Date(c.date),
                user: c.counselor?.name
            })),
            ...assignmentHistory.map(h => ({
                id: `assign-${h.id}`,
                type: 'Assignment',
                action: 'Custodian Changed',
                details: `Assigned to ${h.assignedTo?.name || 'Unknown'} by ${h.assignedBy?.name || 'System'}` + (h.previousOwner ? ` (Previous Owner: ${h.previousOwner.name})` : ''),
                timestamp: h.assignedAt,
                user: h.assignedBy?.name || 'System'
            })),
            ...followups.map(f => ({
                id: `follow-${f.id}`,
                type: 'Followup',
                action: 'Follow-up Scheduled',
                details: `Scheduled for ${new Date(f.scheduledTime).toLocaleDateString()} — Status: ${f.status}`,
                timestamp: f.createdAt,
                user: f.counselor?.name
            }))
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ success: true, data: story });
    } catch (error) {
        next(error);
    }
};
