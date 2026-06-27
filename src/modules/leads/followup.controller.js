const prisma = require('../../config/prisma');
const socketManager = require('../../sockets/socketManager');

// Helper to compute derived overdue status dynamically
const withDerivedStatus = (followup) => {
    const isPast = new Date(followup.scheduledTime) < new Date();
    const isNotCompleted = followup.status !== 'Completed' && followup.status !== 'Cancelled';
    return {
        ...followup,
        isOverdue: isPast && isNotCompleted
    };
};

// ─────────────────────────────────────────────────
// CREATE FOLLOW-UP
// ─────────────────────────────────────────────────
exports.createFollowup = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const { scheduledTime, notes } = req.body;
        const userId = req.user.id;
        const role = req.user.roleName;

        // Verify lead ownership/access applying role scope
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, ...req.leadScope }
        });
        if (!lead) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not have access to this lead' });
        }

        if (new Date(scheduledTime) < new Date()) {
            return res.status(400).json({ success: false, message: 'Scheduled time cannot be in the past' });
        }

        const followup = await prisma.$transaction(async (tx) => {
            const newFollowup = await tx.leadFollowup.create({
                data: {
                    leadId,
                    counselorId: lead.assignedTo || userId, // Default to creator if lead is unassigned
                    scheduledTime: new Date(scheduledTime),
                    status: 'Pending',
                    notes: notes || null
                }
            });

            await tx.lead.update({
                where: { id: leadId },
                data: { followUpDate: new Date(scheduledTime) }
            });

            await tx.activityLog.create({
                data: {
                    userId,
                    action: 'FOLLOWUP_CREATED',
                    module: 'followups',
                    leads: String(leadId),
                    details: `Follow-up scheduled for lead "${lead.name}" on ${new Date(scheduledTime).toLocaleString()}`,
                    status: 'Success'
                }
            });

            return newFollowup;
        });

        socketManager.events.dashboardRefresh({ trigger: 'followup_created', leadId });

        res.status(201).json({
            success: true,
            message: 'Follow-up scheduled successfully',
            data: withDerivedStatus(followup)
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// COMPLETE FOLLOW-UP
// ─────────────────────────────────────────────────
exports.completeFollowup = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const followupId = parseInt(req.params.followupId);
        const { notes } = req.body;
        const userId = req.user.id;

        if (!notes || notes.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Completion notes are required (minimum 10 characters)' });
        }

        const lead = await prisma.lead.findFirst({
            where: { id: leadId, ...req.leadScope }
        });
        if (!lead) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not have access to this lead' });
        }

        const followup = await prisma.leadFollowup.findUnique({
            where: { id: followupId },
            include: { lead: true }
        });

        if (!followup || followup.leadId !== leadId) {
            return res.status(404).json({ success: false, message: 'Follow-up not found for this lead' });
        }

        // Only assigned counselor or Admin/Manager/TL can edit
        if (req.user.roleName === 'COUNSELOR' && followup.counselorId !== userId) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this follow-up' });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const completed = await tx.leadFollowup.update({
                where: { id: followupId },
                data: {
                    status: 'Completed',
                    completedAt: new Date(),
                    notes
                }
            });

            // Clear followUpDate if there are no other pending followups
            const otherPending = await tx.leadFollowup.findFirst({
                where: { leadId, status: 'Pending', id: { not: followupId } },
                orderBy: { scheduledTime: 'asc' }
            });

            await tx.lead.update({
                where: { id: leadId },
                data: { followUpDate: otherPending ? otherPending.scheduledTime : null }
            });

            await tx.activityLog.create({
                data: {
                    userId,
                    action: 'FOLLOWUP_COMPLETED',
                    module: 'followups',
                    leads: String(leadId),
                    details: `Follow-up completed for lead "${followup.lead.name}". Notes: ${notes}`,
                    status: 'Success'
                }
            });

            return completed;
        });

        socketManager.events.dashboardRefresh({ trigger: 'followup_completed', leadId });

        res.json({
            success: true,
            message: 'Follow-up marked as completed',
            data: withDerivedStatus(updated)
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// RESCHEDULE FOLLOW-UP
// ─────────────────────────────────────────────────
exports.rescheduleFollowup = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const followupId = parseInt(req.params.followupId);
        const { scheduledTime, notes } = req.body;
        const userId = req.user.id;

        if (!notes || notes.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Reschedule reason notes are required (minimum 10 characters)' });
        }

        if (new Date(scheduledTime) < new Date()) {
            return res.status(400).json({ success: false, message: 'New scheduled time cannot be in the past' });
        }

        const lead = await prisma.lead.findFirst({
            where: { id: leadId, ...req.leadScope }
        });
        if (!lead) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not have access to this lead' });
        }

        const followup = await prisma.leadFollowup.findUnique({
            where: { id: followupId },
            include: { lead: true }
        });

        if (!followup || followup.leadId !== leadId) {
            return res.status(404).json({ success: false, message: 'Follow-up not found for this lead' });
        }

        if (req.user.roleName === 'COUNSELOR' && followup.counselorId !== userId) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this follow-up' });
        }

        const result = await prisma.$transaction(async (tx) => {
            // Update current followup to Rescheduled
            await tx.leadFollowup.update({
                where: { id: followupId },
                data: { status: 'Rescheduled', notes: `Rescheduled: ${notes}` }
            });

            // Create new follow-up
            const newFollowup = await tx.leadFollowup.create({
                data: {
                    leadId,
                    counselorId: followup.counselorId,
                    scheduledTime: new Date(scheduledTime),
                    status: 'Pending',
                    rescheduledFromId: followupId
                }
            });

            // Sync lead next followup date
            await tx.lead.update({
                where: { id: leadId },
                data: { followUpDate: new Date(scheduledTime) }
            });

            await tx.activityLog.create({
                data: {
                    userId,
                    action: 'FOLLOWUP_RESCHEDULED',
                    module: 'followups',
                    leads: String(leadId),
                    details: `Follow-up rescheduled. Reason: ${notes}. New date: ${new Date(scheduledTime).toLocaleString()}`,
                    status: 'Success'
                }
            });

            return newFollowup;
        });

        socketManager.events.dashboardRefresh({ trigger: 'followup_rescheduled', leadId });

        res.json({
            success: true,
            message: 'Follow-up rescheduled successfully',
            data: withDerivedStatus(result)
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// CANCEL FOLLOW-UP
// ─────────────────────────────────────────────────
exports.cancelFollowup = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const followupId = parseInt(req.params.followupId);
        const { notes } = req.body;
        const userId = req.user.id;

        if (!notes || notes.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Cancellation notes are required (minimum 10 characters)' });
        }

        const lead = await prisma.lead.findFirst({
            where: { id: leadId, ...req.leadScope }
        });
        if (!lead) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not have access to this lead' });
        }

        const followup = await prisma.leadFollowup.findUnique({
            where: { id: followupId },
            include: { lead: true }
        });

        if (!followup || followup.leadId !== leadId) {
            return res.status(404).json({ success: false, message: 'Follow-up not found for this lead' });
        }

        if (req.user.roleName === 'COUNSELOR' && followup.counselorId !== userId) {
            return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this follow-up' });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const cancelled = await tx.leadFollowup.update({
                where: { id: followupId },
                data: { status: 'Cancelled', notes }
            });

            // Recalculate nearest pending follow-up for lead followUpDate
            const nextPending = await tx.leadFollowup.findFirst({
                where: { leadId, status: 'Pending', id: { not: followupId } },
                orderBy: { scheduledTime: 'asc' }
            });

            await tx.lead.update({
                where: { id: leadId },
                data: { followUpDate: nextPending ? nextPending.scheduledTime : null }
            });

            await tx.activityLog.create({
                data: {
                    userId,
                    action: 'FOLLOWUP_CANCELLED',
                    module: 'followups',
                    leads: String(leadId),
                    details: `Follow-up cancelled for lead "${followup.lead.name}". Reason: ${notes}`,
                    status: 'Success'
                }
            });

            return cancelled;
        });

        socketManager.events.dashboardRefresh({ trigger: 'followup_cancelled', leadId });

        res.json({
            success: true,
            message: 'Follow-up cancelled',
            data: withDerivedStatus(updated)
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// GET FOLLOW-UPS FOR LEAD
// ─────────────────────────────────────────────────
exports.getLeadFollowups = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.id);
        const followups = await prisma.leadFollowup.findMany({
            where: { leadId },
            orderBy: { scheduledTime: 'asc' }
        });

        res.json({
            success: true,
            data: followups.map(withDerivedStatus)
        });
    } catch (error) {
        next(error);
    }
};
