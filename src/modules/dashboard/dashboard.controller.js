const fs = require('fs');
const path = require('path');
const prisma = require('../../config/prisma');
const socketManager = require('../../sockets/socketManager');
const { exportAll } = require('../../../scripts/export_db');

// @desc    Get consolidated KPI stats for dashboards
// @route   GET /api/dashboard/kpi
exports.getKpiStats = async (req, res, next) => {
    try {
        const stats = await prisma.superAdminDashboard.findFirst({
            orderBy: { createdAt: 'desc' }
        });

        const aggregated = {
            totalClients: await prisma.subscription.count(),
            totalLeads: await prisma.lead.count(),
            totalRevenue: 125000,
            activeChannels: await prisma.channel.count({ where: { status: 'Active' } })
        };

        res.json({ success: true, data: stats || aggregated });
    } catch (error) {
        next(error);
    }
};

// @desc    Update Super Admin Dashboard stats 
exports.updateSuperAdminDashboard = async (req, res, next) => {
    try {
        const stats = {
            totalClients: await prisma.subscription.count(),
            totalLeads: await prisma.lead.count(),
            totalRevenue: 125000,
            activeChannels: await prisma.channel.count({ where: { status: 'Active' } })
        };

        const updated = await prisma.superAdminDashboard.create({ data: stats });
        socketManager.events.dashboardRefresh(stats);

        res.json({ success: true, message: 'Dashboard stats updated in database', data: updated });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Admin Dashboard Stats
exports.getAdminDashboard = async (req, res, next) => {
    try {
        const [connectedWhatsapp, facebookPages, websiteLeads, routingPreviewRaw] = await Promise.all([
            prisma.channel.count({ where: { type: 'WhatsApp' } }),
            prisma.channel.count({ where: { type: 'Facebook' } }),
            prisma.lead.count({ where: { source: 'Website' } }),
            prisma.routingRule.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5
            })
        ]);

        let aiConfig;
        try {
            aiConfig = await prisma.aiConfig.findUnique({ where: { id: 1 } });
        } catch (e) {
            aiConfig = null;
        }

        const routingPreview = routingPreviewRaw.map(rule => ({
            country: rule.country || 'Global',
            team: rule.team || 'General',
            counselor: rule.counselor || 'Auto-assign',
            type: rule.type?.replace('_', ' ') || 'Direct',
            status: rule.status || 'Active'
        }));

        const aggregated = {
            connectedWhatsapp,
            facebookPages,
            websiteLeads,
            routingPreview,
            aiStatus: {
                enabled: aiConfig ? true : false,
                lastUpdated: aiConfig?.createdAt ? new Date(aiConfig.createdAt).toLocaleTimeString() : 'N/A'
            }
        };

        res.json({ success: true, data: aggregated });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Manager Dashboard Stats
// @desc    Get Manager Dashboard Stats
exports.getManagerDashboard = async (req, res, next) => {
    try {
        const leadWhere = { ...req.leadScope };
        
        const [totalLeads, qualifiedLeads, convertedLeads, enrolledLeads, lostLeads] = await Promise.all([
            prisma.lead.count({ where: leadWhere }),
            prisma.lead.count({ where: { ...leadWhere, stage: 'Qualified' } }),
            prisma.lead.count({ where: { ...leadWhere, stage: 'Converted' } }),
            prisma.lead.count({ where: { ...leadWhere, stage: 'Enrolled' } }),
            prisma.lead.count({ where: { ...leadWhere, stage: 'Lost' } })
        ]);

        const kpis = [
            { type: 'leads_today', title: 'Leads Generated', value: totalLeads.toString(), subText: '+12%' },
            { type: 'qualified_today', title: 'Qualified Leads', value: qualifiedLeads.toString(), subText: '+5%' },
            { type: 'converted_today', title: 'Enrolled Students', value: convertedLeads.toString(), subText: '+18%' },
            { type: 'sla_breach', title: 'Action Pendings', value: lostLeads.toString(), subText: '-2%' }
        ];

        // Funnel Summary Aggregation
        const funnelRaw = await prisma.lead.groupBy({
            by: ['stage'],
            where: leadWhere,
            _count: { _all: true }
        });

        const funnelSummary = funnelRaw.map(item => ({
            stage: item.stage || 'Untracked',
            total: item._count._all,
            conversion: `${Math.round((item._count._all / (totalLeads || 1)) * 100)}%`,
            dropoff: `${Math.round(100 - (item._count._all / (totalLeads || 1)) * 100)}%`
        }));

        // Country Performance Aggregation
        const countryRaw = await prisma.lead.groupBy({
            by: ['country'],
            where: leadWhere,
            _count: { _all: true }
        });

        const countryPerformance = await Promise.all(countryRaw.map(async item => {
            const country = item.country || 'Global';
            const converted = await prisma.lead.count({ where: { country: item.country, stage: 'Converted' } });
            const enrolled = await prisma.lead.count({ where: { country: item.country, stage: 'Enrolled' } });

            return {
                country,
                leads: item._count._all,
                converted,
                enrolled,
                teams: 1, // Placeholder for team count per country
                responseTime: '15m' // Placeholder
            };
        }));

        res.json({
            success: true,
            data: {
                kpis,
                funnelSummary,
                countryPerformance: countryPerformance.sort((a, b) => b.leads - a.leads)
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a database snapshot
exports.createSnapshot = async (req, res, next) => {
    try {
        console.log("[SNAPSHOT LOG]: Executing optimized snapshot logic v1.2...");
        
        const rootDir = process.cwd();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const snapshotsDir = path.join(rootDir, 'data', 'snapshots');
        const snapshotPath = path.join(snapshotsDir, `crm_snapshot_${timestamp}.json`);

        // 1. Export directly to the snapshots directory (no copy needed)
        await exportAll(snapshotPath);

        res.json({
            success: true,
            message: `Snapshot created successfully: crm_snapshot_${timestamp}.json`,
            data: { 
                filename: `crm_snapshot_${timestamp}.json`,
                timestamp: new Date().toISOString(),
                status: "Optimized Direct Export"
            }
        });
    } catch (error) {
        console.error('[SNAPSHOT ERROR]:', error.message);
        next(error);
    }
};

// @desc    Update AI Configuration
exports.updateAiConfig = async (req, res, next) => {
    try {
        const { flow, threshold, rules, scoringRules, enabled } = req.body;

        // Validation
        const parsedThreshold = threshold !== undefined ? parseInt(threshold) : undefined;
        if (parsedThreshold !== undefined && isNaN(parsedThreshold)) {
            return res.status(400).json({ success: false, message: 'Invalid threshold value. Must be a number.' });
        }

        const updateData = {};
        if (flow !== undefined) updateData.flow = flow;
        if (parsedThreshold !== undefined) updateData.threshold = parsedThreshold;
        if (rules !== undefined) updateData.rules = rules;
        if (scoringRules !== undefined) updateData.scoringRules = scoringRules;
        if (enabled !== undefined) updateData.enabled = enabled;

        const config = await prisma.aiConfig.upsert({
            where: { id: 1 },
            update: updateData,
            create: {
                id: 1,
                flow: flow || [],
                threshold: parsedThreshold || 75,
                rules: rules || [],
                scoringRules: scoringRules || [],
                enabled: enabled !== undefined ? enabled : true
            }
        });

        try { await exportAll(); } catch (e) { /* non-critical */ }

        res.json({ success: true, message: 'AI Protocol Synchronized successfully', data: config });
    } catch (error) {
        next(error);
    }
};

// @desc    Get AI Configuration
exports.getAiConfig = async (req, res, next) => {
    try {
        let config = await prisma.aiConfig.findUnique({ where: { id: 1 } });

        if (!config) {
            config = {
                flow: [
                    { id: 1, q: "What is your country of residence?", t: "Country" },
                    { id: 2, q: "Which program are you interested in?", t: "Program" },
                    { id: 3, q: "Which intake session are you aiming for?", t: "Intake" },
                    { id: 4, q: "What is your estimated education budget?", t: "Budget" }
                ],
                threshold: 75,
                rules: [
                    { id: 'auto_assign', label: 'Autonomous Lead Assignment', active: true, desc: 'Redirect hot leads without human triage' },
                    { id: 'crm_sync', label: 'Bi-directional CRM Webhook', active: true, desc: 'Sync qualified data to external masters' }
                ],
                scoringRules: [
                    { id: 1, desc: 'Inquiry from Tier-1 Territory', score: 25 },
                    { id: 2, desc: 'Interest in Premium Course', score: 30 },
                    { id: 3, desc: 'Budget matched > $15k', score: 20 },
                    { id: 4, desc: 'Repeat inquiry within 30 days', score: -10 }
                ],
                enabled: true
            };
        }

        res.json({ success: true, data: config });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Super Admin Dashboard   
exports.getSuperAdminDashboard = async (req, res, next) => {
    try {
        const [totalClients, totalLeads, activeChannels, users] = await Promise.all([
            prisma.subscription.count(),
            prisma.lead.count(),
            prisma.channel.count({ where: { status: 'Active' } }),
            prisma.user.count()
        ]);

        res.json({
            success: true, data: {
                totalClients,
                totalLeads,
                totalRevenue: totalClients * 499,
                activeChannels,
                totalUsers: users
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Team Leader Dashboard
exports.getTeamLeaderDashboard = async (req, res, next) => {
    try {
        const { country, team, status } = req.query;

        const filter = { ...req.leadScope };
        if (country && country !== 'Global') filter.country = country;
        if (team && team !== 'All Operators') filter.team = team;
        if (status && status !== 'All Stages') filter.stage = status;

        const [teamLeads, pendingLeads, qualifiedLeads, slaBreaches] = await Promise.all([
            prisma.lead.count({ where: filter }),
            prisma.lead.count({ where: { ...filter, stage: 'New' } }),
            prisma.lead.count({ where: { ...filter, stage: 'Qualified' } }),
            prisma.lead.count({ where: { ...filter, stage: 'Lost' } })
        ]);

        const data = {
            teamLeads: teamLeads.toString(),
            pendingReplies: pendingLeads.toString(),
            slaBreaches: slaBreaches.toString(),
            kpis: [
                { type: 'team_leads', title: 'Team Leads', value: teamLeads.toString(), subText: 'Total' },
                { type: 'pending_replies', title: 'Pending', value: pendingLeads.toString(), subText: 'To Reply' },
                { type: 'qualified', title: 'Qualified', value: qualifiedLeads.toString(), subText: 'This Week' },
                { type: 'sla_breach', title: 'SLA Breaches', value: slaBreaches.toString(), subText: 'Critical' }
            ]
        };

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Counselor Dashboard
exports.getCounselorDashboard = async (req, res, next) => {
    try {
        const userId = req.user?.id;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const now = new Date();

        const [assignedLeads, hotLeads, followUps, converted, todaysFollowupsRaw, overdueFollowupsRaw, missedFollowups] = await Promise.all([
            prisma.lead.count({ where: { assignedTo: userId } }),
            prisma.lead.count({ where: { assignedTo: userId, score: { gte: 80 } } }),
            prisma.leadFollowup.count({ where: { counselorId: userId, status: 'Pending' } }),
            prisma.lead.count({ where: { assignedTo: userId, stage: 'Converted' } }),
            prisma.leadFollowup.findMany({
                where: { 
                    counselorId: userId, 
                    scheduledTime: { gte: startOfDay, lte: endOfDay }
                },
                include: { lead: { select: { name: true } } },
                orderBy: { scheduledTime: 'asc' }
            }),
            prisma.leadFollowup.findMany({
                where: { 
                    counselorId: userId, 
                    status: 'Pending',
                    scheduledTime: { lt: now } 
                },
                include: { lead: { select: { name: true } } },
                orderBy: { scheduledTime: 'asc' }
            }),
            prisma.leadFollowup.count({
                where: { 
                    counselorId: userId, 
                    status: 'Missed',
                    scheduledTime: { gte: startOfDay, lte: endOfDay }
                }
            })
        ]);

        // Map arrays and attach 'isOverdue' manually where applicable
        const todaysFollowups = todaysFollowupsRaw.map(f => ({
            ...f,
            isOverdue: f.scheduledTime < now && f.status === 'Pending'
        }));
        const overdueFollowups = overdueFollowupsRaw.map(f => ({
            ...f,
            isOverdue: true
        }));

        const actionPendings = overdueFollowups.length + missedFollowups;

        const data = {
            assignedLeads,
            hotLeads,
            followUps,
            converted,
            actionPendings,
            todaysFollowups,
            overdueFollowups,
            missedFollowups,
            kpis: [
                { type: 'assigned_leads', title: 'My Leads', value: assignedLeads.toString(), subText: 'Assigned' },
                { type: 'hot_leads', title: 'Hot Leads', value: hotLeads.toString(), subText: 'Score > 80' },
                { type: 'follow_ups', title: 'Follow-Ups', value: followUps.toString(), subText: 'Scheduled' },
                { type: 'converted', title: 'Converted', value: converted.toString(), subText: 'This Month' }
            ]
        };

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Support Dashboard
exports.getSupportDashboard = async (req, res, next) => {
    try {
        const [openTickets, newMessages, assignedChats, unassignedLeads] = await Promise.all([
            prisma.lead.count({ where: { stage: 'New' } }),
            prisma.message.count({ where: { isRead: false } }),
            prisma.lead.count({ where: { assignedTo: { not: null } } }),
            prisma.lead.count({ where: { assignedTo: null } })
        ]);

        const kpis = [
            { type: 'open_tickets', title: 'Open Tickets', value: openTickets.toString(), subText: 'New' },
            { type: 'new_messages', title: 'New Messages', value: newMessages.toString(), subText: 'Unread' },
            { type: 'assigned_chats', title: 'Assigned', value: assignedChats.toString(), subText: 'Active' },
            { type: 'unassigned', title: 'Queue', value: unassignedLeads.toString(), subText: 'Pending' }
        ];

        res.json({ success: true, data: { kpis } });
    } catch (error) {
        next(error);
    }
};

// @desc    Get overall dashboard stats
exports.getDashboardStats = async (req, res, next) => {
    try {
        const [totalLeads, totalUsers, activeChannels, unreadMessages] = await Promise.all([
            prisma.lead.count(),
            prisma.user.count(),
            prisma.channel.count({ where: { status: 'Active' } }),
            prisma.message.count({ where: { isRead: false } })
        ]);

        res.json({
            success: true, data: {
                totalLeads,
                totalUsers,
                activeChannels,
                unreadMessages
            }
        });
    } catch (error) {
        next(error);
    }
};
