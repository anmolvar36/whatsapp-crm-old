const prisma = require('../../config/prisma');

// @desc    Get team leader dashboard
// @route   GET /api/team-leader/dashboard
exports.getDashboard = async (req, res, next) => {
    try {
        const { country, team, status } = req.query;

        const filter = {};
        if (country && country !== 'Global') filter.country = country;
        if (team && team !== 'All Operators') filter.team = team;
        if (status && status !== 'All Stages') filter.stage = status;

        const slaThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

        const [teamLeads, pendingReplies, slaBreaches] = await Promise.all([
            prisma.lead.count({ where: filter }),
            prisma.message.count({
                where: {
                    isRead: false,
                    lead: filter
                }
            }),
            prisma.message.count({
                where: {
                    isRead: false,
                    timestamp: { lt: slaThreshold },
                    lead: filter
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                teamLeads: teamLeads.toString(),
                pendingReplies: pendingReplies.toString(),
                slaBreaches: slaBreaches.toString()
            }
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Get assigned leads
// @route   GET /api/team-leader/leads
exports.getLeads = async (req, res, next) => {
    try {
        const { country, team, status } = req.query;

        const where = {};
        if (country && country !== 'Global') where.country = country;
        if (team && team !== 'All Operators') where.team = team;
        if (status && status !== 'All Stages') where.stage = status;

        const leads = await prisma.lead.findMany({
            where,
            include: {
                assignedUser: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Enforce data mapping for TL view
        const formatted = leads.map(l => ({
            id: l.id,
            leadName: l.name,
            counselor: l.assignedUser ? l.assignedUser.name : 'Unassigned',
            country: l.country || 'Global',
            status: l.stage || 'New',
            source: l.source || 'Website',
            lastActivity: 'Active Now'
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        next(error);
    }
};

// @desc    Get performance metrics
// @route   GET /api/team-leader/performance
exports.getPerformance = async (req, res, next) => {
    try {
        const { country, team } = req.query;

        const where = {
            role: { name: 'COUNSELOR' },
            status: 'Active'
        };

        if (country && country !== 'Global') where.country = country;
        if (team && team !== 'All Operators') where.team = team;

        const activeCounselors = await prisma.user.findMany({ where });

        const data = await Promise.all(activeCounselors.map(async (counselor) => {
            const leadsCount = await prisma.lead.count({ where: { assignedTo: counselor.id } });
            const convertedCount = await prisma.lead.count({ where: { assignedTo: counselor.id, stage: 'Converted' } });

            // Re-calculate replies based on Sent messages by this counselor
            const repliesCount = await prisma.message.count({
                where: {
                    sender: counselor.name,
                    lead: { assignedTo: counselor.id }
                }
            });

            // Ensure CounselorPerformance is populated (Historical record)
            let perf = await prisma.counselorPerformance.findFirst({
                where: { counselorName: counselor.name }
            });

            if (!perf) {
                perf = await prisma.counselorPerformance.create({
                    data: {
                        counselorName: counselor.name,
                        replies: repliesCount,
                        conversions: convertedCount,
                        avgResponse: '5m'
                    }
                });
            } else {
                perf = await prisma.counselorPerformance.update({
                    where: { id: perf.id },
                    data: {
                        conversions: convertedCount,
                        replies: repliesCount
                    }
                });
            }

            return {
                id: counselor.id,
                counselor: counselor.name,
                totalLeads: leadsCount,
                replies: repliesCount,
                conversions: convertedCount,
                avgResponse: perf.avgResponse,
                activeConv: leadsCount - convertedCount,
                status: counselor.status,
                perfId: perf.id
            };
        }));

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Reassign lead
// @route   PUT /api/team-leader/leads/:id/reassign
exports.reassignLead = async (req, res, next) => {
    try {
        const { newCounselor } = req.body; // In a real app we'd send ID
        const leadId = parseInt(req.params.id);

        // Find user by EXACT name match since the frontend now passes real PRISMA user names
        const user = await prisma.user.findFirst({
            where: { name: newCounselor }
        });

        if (!user) return res.status(404).json({ success: false, message: 'Counselor not found' });

        const currentLead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { assignedTo: true, name: true }
        });

        if (!currentLead) return res.status(404).json({ success: false, message: 'Lead not found' });
        const previousOwnerId = currentLead.assignedTo;

        await prisma.$transaction(async (tx) => {
            await tx.lead.update({
                where: { id: leadId },
                data: { assignedTo: user.id }
            });

            await tx.leadAssignmentHistory.create({
                data: {
                    leadId,
                    assignedById: req.user?.id || null,
                    assignedToId: user.id,
                    previousOwnerId
                }
            });

            await tx.message.create({
                data: {
                    leadId,
                    message: `System: Lead reassigned to Counselor ${user.name}.`,
                    sender: 'System',
                    channel: 'System'
                }
            });

            await tx.activityLog.create({
                data: {
                    userId: req.user?.id || null,
                    action: 'LEAD_REASSIGNED',
                    module: 'leads',
                    details: `Lead "${currentLead.name}" (ID: ${leadId}) reassigned to Counselor "${user.name}" (ID: ${user.id}) by Team Leader "${req.user?.name}"`,
                    status: 'Success'
                }
            });
        });

        res.json({ success: true, message: `Reassigned to ${user.name}` });
    } catch (error) {
        next(error);
    }
};

// @desc    Update lead status (TL action)
// @route   PUT /api/team-leader/leads/:id/status
exports.updateLeadStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        await prisma.lead.update({
            where: { id: parseInt(req.params.id) },
            data: { stage: status }
        });
        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        next(error);
    }
};

// @desc    Add team note
// @route   POST /api/team-leader/notes
exports.addTeamNote = async (req, res, next) => {
    try {
        const { note, lead } = req.body;

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Added Note',
                module: 'Team Leader',
                leads: lead || 'General',
                details: note,
                status: 'Success'
            }
        });

        res.json({ success: true, message: 'Team note saved to activity log' });
    } catch (error) {
        next(error);
    }
};


// @desc    Get SLA alerts for team
// @route   GET /api/team-leader/sla-alerts
exports.getSlaAlerts = async (req, res, next) => {
    try {
        const { country, team } = req.query;
        const breachThreshold = new Date(Date.now() - 30 * 60 * 1000);  // 30 mins = Breached
        const warningThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 mins = Warning
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const leadFilter = {};
        if (country && country !== 'Global') leadFilter.country = country;
        if (team && team !== 'All Operators') leadFilter.team = team;

        // Fetch both breached and warning-level messages (15min+ unread)
        const pendingMessages = await prisma.message.findMany({
            where: {
                isRead: false,
                timestamp: { lt: warningThreshold, gt: dayAgo },
                lead: leadFilter
            },
            include: {
                lead: { include: { assignedUser: true } }
            },
            orderBy: { timestamp: 'asc' },
            take: 50
        });

        let alerts = pendingMessages.map(msg => {
            const delayInMinutes = Math.floor((Date.now() - new Date(msg.timestamp).getTime()) / 60000);
            const isBreached = new Date(msg.timestamp) < breachThreshold;
            return {
                id: msg.id,
                leadId: msg.leadId,
                status: isBreached ? 'Breached' : 'Warning',
                leadName: msg.lead?.name || 'Unknown Lead',
                counselor: msg.lead?.assignedUser ? msg.lead.assignedUser.name : 'Unassigned',
                delay: delayInMinutes,
                limit: 30,
                breachTime: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
        });

        // If still empty, fallback to any unread messages from last 24h
        if (alerts.length === 0) {
            const recentMessages = await prisma.message.findMany({
                where: { isRead: false, timestamp: { gt: dayAgo }, lead: leadFilter },
                include: { lead: { include: { assignedUser: true } } },
                orderBy: { timestamp: 'asc' },
                take: 20
            });
            alerts = recentMessages.map(msg => {
                const delayInMinutes = Math.floor((Date.now() - new Date(msg.timestamp).getTime()) / 60000);
                return {
                    id: msg.id,
                    leadId: msg.leadId,
                    status: delayInMinutes > 30 ? 'Breached' : 'Warning',
                    leadName: msg.lead?.name || 'Unknown Lead',
                    counselor: msg.lead?.assignedUser ? msg.lead.assignedUser.name : 'Unassigned',
                    delay: delayInMinutes,
                    limit: 30,
                    breachTime: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
            });
        }

        res.json({ success: true, data: alerts });
    } catch (error) {
        next(error);
    }
};


// @desc    Get team inbox messages
// @route   GET /api/team-leader/inbox
exports.getInbox = async (req, res, next) => {
    try {
        const { country, team } = req.query;

        const where = {};
        if (country && country !== 'Global') where.lead = { country };
        if (team && team !== 'All Operators') where.lead = { ...where.lead, team };

        const messages = await prisma.message.findMany({
            where,
            take: 20,
            orderBy: { timestamp: 'desc' },
            include: {
                lead: {
                    include: { assignedUser: true }
                }
            }
        });

        const formatted = messages.map(msg => ({
            id: msg.id,
            leadName: msg.lead?.name || 'Unknown Lead',
            country: msg.lead?.country || 'Global',
            counselor: msg.lead?.assignedUser?.name || 'Unassigned',
            status: !msg.isRead ? 'Pending' : 'Active',
            lastMessage: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            slaTimer: !msg.isRead ? `${Math.floor((Date.now() - new Date(msg.timestamp).getTime()) / 60000)}m` : '-'
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        next(error);
    }
};

// @desc    Get team activity logs
// @route   GET /api/team-leader/activity-logs
exports.getActivityLogs = async (req, res, next) => {
    try {
        const logs = await prisma.activityLog.findMany({
            take: 20,
            orderBy: { timestamp: 'desc' },
            include: { user: { select: { name: true } } }
        });
        res.json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
};

// @desc    Send reminder to counselor
// @route   POST /api/team-leader/reminder
exports.sendReminder = async (req, res, next) => {
    try {
        const { counselorId } = req.body;
        // Mock notification logic
        res.json({ success: true, message: 'Reminder sent to counselor' });
    } catch (error) {
        next(error);
    }
};

