const prisma = require('../../config/prisma');

// @desc    Get system-wide analytics summary
// @route   GET /api/analytics/summary
exports.getSummary = async (req, res, next) => {
    try {
        const { country, status, operator, dateLabel } = req.query;

        const leadWhere = { ...req.leadScope };
        if (country && country !== 'Global') leadWhere.country = country;
        if (status && status !== 'All Stages') leadWhere.stage = status;

        if (operator && operator !== 'All Operators') {
            const opUser = await prisma.user.findFirst({ where: { name: operator } });
            if (opUser) {
                // If the user is a counselor, they can't see other operators' data anyway via leadScope
                leadWhere.assignedTo = opUser.id;
            }
        }

        if (dateLabel && dateLabel !== 'All Records') {
            const now = new Date();
            let gte;
            if (dateLabel === 'Today') {
                gte = new Date(now.setHours(0, 0, 0, 0));
            } else if (dateLabel === 'Last 7 Days') {
                gte = new Date(now.setDate(now.getDate() - 7));
            } else if (dateLabel === 'Last 30 Days') {
                gte = new Date(now.setDate(now.getDate() - 30));
            } else if (dateLabel === 'This Month') {
                gte = new Date(now.getFullYear(), now.getMonth(), 1);
            }
            if (gte) leadWhere.createdAt = { gte };
        }

        const [leads, users, leadStatuses] = await Promise.all([
            prisma.lead.findMany({
                where: leadWhere,
                include: { assignedUser: true }
            }),
            prisma.user.findMany({ 
                include: { role: true } 
            }),
            prisma.leadStatus.findMany()
        ]);

        // 1. Geographic Distribution
        const countryMap = {};
        leads.forEach(l => {
            const key = l.country || 'Unknown';
            if (!countryMap[key]) countryMap[key] = { 'Country Zone': key, 'Total Leads Generated': 0, 'Qualified Pipelines': 0 };
            countryMap[key]['Total Leads Generated']++;
            if (['Qualified', 'Enrolled'].includes(l.stage)) countryMap[key]['Qualified Pipelines']++;
        });

        // 2. Lead Funnel (Stage Distribution)
        const funnelMap = {};
        // Initialize funnel with all statuses
        leadStatuses.forEach(s => {
            funnelMap[s.name] = { stage: s.name, count: 0 };
        });
        leads.forEach(l => {
            if (funnelMap[l.stage]) funnelMap[l.stage].count++;
            else funnelMap[l.stage] = { stage: l.stage, count: 1 };
        });

        // 3. Conversion Metrics
        const totalLeads = leads.length;
        const convertedLeads = leads.filter(l => l.stage === 'Converted').length;
        const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

        // 4. Team Performance
        const teamPerf = {};
        users.filter(u => u.role?.name === 'COUNSELOR').forEach(u => {
            const userLeads = leads.filter(l => l.assignedTo === u.id);
            const userConverted = userLeads.filter(l => l.stage === 'Converted').length;
            teamPerf[u.name] = {
                name: u.name,
                leads: userLeads.length,
                conversions: userConverted,
                rate: userLeads.length > 0 ? ((userConverted / userLeads.length) * 100).toFixed(1) + '%' : '0%'
            };
        });

        res.json({
            success: true,
            data: {
                summary: {
                    totalLeads,
                    convertedLeads,
                    conversionRate: conversionRate + '%'
                },
                leadsByCountry: Object.values(countryMap),
                leadFunnel: Object.values(funnelMap),
                teamPerformance: Object.values(teamPerf),
                leadsBySource: Object.values(groupBy(leads, 'source', 'Ingress Channel', 'Total Leads'))
            }
        });
    } catch (error) {
        next(error);
    }
};

const groupBy = (items, key, labelKey, countKey) => {
    const map = {};
    items.forEach(item => {
        const val = item[key] || 'Direct';
        if (!map[val]) map[val] = { [labelKey]: val, [countKey]: 0 };
        map[val][countKey]++;
    });
    return map;
};

exports.getExport = async (req, res, next) => {
    try {
        const where = { ...req.leadScope };
        const leads = await prisma.lead.findMany({ where });
        res.json({ success: true, data: leads });
    } catch (error) {
        next(error);
    }
};
