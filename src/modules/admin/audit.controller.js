const prisma = require('../../config/prisma');

// @desc    Get all audit logs
// @route   GET /api/audit
exports.getAuditLogs = async (req, res, next) => {
    try {
        const { country } = req.query;
        const where = {};
        if (country && country !== 'Global') {
            // Filter logs by the country of the user who performed the activity
            where.user = { country: country };
        }

        const logs = await prisma.activityLog.findMany({
            where,
            include: {
                user: {
                    select: { name: true, role: true }
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        const formattedLogs = logs.map(l => ({
            ...l,
            createdAt: l.timestamp, // alias for frontend compatibility
            user: l.user ? l.user.name : 'System Node',
            role: l.user ? (typeof l.user.role === 'object' ? l.user.role.name : l.user.role) : 'System'
        }));

        res.json({ success: true, data: formattedLogs });
    } catch (error) {
        console.error('[AuditLogs] Fetch Error:', error);
        next(error);
    }
};

// @desc    Export audit logs
// @route   POST /api/audit/export
exports.exportLogs = async (req, res, next) => {
    try {
        const { country, moduleFilter, userFilter, searchTerm } = req.body;

        const where = {};

        // Define relation filters securely if needed
        const userFilters = {};
        if (country && country !== 'Global') userFilters.country = country;
        if (userFilter && userFilter !== 'All Users') userFilters.name = userFilter;

        if (Object.keys(userFilters).length > 0) {
            where.user = userFilters;
        }

        if (moduleFilter && moduleFilter !== 'All Modules') where.module = moduleFilter;

        if (searchTerm) {
            where.OR = [
                { action: { contains: searchTerm } },
                { details: { contains: searchTerm } }
            ];
        }

        const logs = await prisma.activityLog.findMany({
            where,
            include: { user: { select: { name: true, role: true } } },
            orderBy: { timestamp: 'desc' }
        });

        let csvContent = 'ID,Timestamp,User,Role,Action,Module,Details,Status,IP,Device\n';

        logs.forEach(l => {
            const roleName = l.user ? (typeof l.user.role === 'object' ? l.user.role.name : l.user.role) : 'System';
            const row = [
                l.id,
                new Date(l.timestamp).toISOString(),
                `"${l.user?.name || 'System Node'}"`,
                `"${roleName}"`,
                `"${l.action || ''}"`,
                `"${l.module || ''}"`,
                `"${l.details?.replace(/"/g, '""') || ''}"`,
                `"${l.status || ''}"`,
                `"${l.ip || ''}"`,
                `"${l.device || ''}"`
            ].join(',');
            csvContent += row + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
    } catch (error) {
        console.error('[AuditLogs] Export Error:', error);
        next(error);
    }
};

// Utility function to log activity (can be used internally)
exports.logActivity = async (userId, action, module, details, status = 'Success', ip = '', device = '') => {
    try {
        await prisma.activityLog.create({
            data: {
                userId: userId ? parseInt(userId) : null,
                action,
                module,
                details,
                status: status || 'Success',
                ip,
                device
            }
        });
    } catch (error) {
        console.error('Failed to log activity:', error.message);
    }
};
