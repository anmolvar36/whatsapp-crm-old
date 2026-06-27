const prisma = require('../config/prisma');

/**
 * Quota System Middleware
 *
 * Tracks:
 * - Leads created per month (limit: configurable)
 * - Messages sent per month (limit: configurable)
 *
 * Alerts at 80% usage
 * Blocks at 100% usage
 */

// Default quota limits (can be made plan-based later)
const QUOTA_LIMITS = {
    LEADS_PER_MONTH: parseInt(process.env.QUOTA_LEADS) || 1000,
    MESSAGES_PER_MONTH: parseInt(process.env.QUOTA_MESSAGES) || 5000,
};

/**
 * Get current month's usage from DB
 */
const getCurrentUsage = async (type) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    if (type === 'LEADS') {
        return await prisma.lead.count({
            where: { createdAt: { gte: startOfMonth } }
        });
    }

    if (type === 'MESSAGES') {
        return await prisma.message.count({
            where: { timestamp: { gte: startOfMonth } }
        }).catch(() => 0);
    }

    return 0;
};

/**
 * Check Lead Quota before creating a lead
 */
const checkLeadQuota = async (req, res, next) => {
    try {
        const role = req.user?.roleName || req.user?.role?.name || '';

        // SuperAdmin and Admin bypass quota
        if (['SUPER_ADMIN', 'ADMIN'].includes(role)) return next();

        const currentCount = await getCurrentUsage('LEADS');
        const limit = QUOTA_LIMITS.LEADS_PER_MONTH;
        const percentage = (currentCount / limit) * 100;

        // Block at 100%
        if (currentCount >= limit) {
            return res.status(429).json({
                success: false,
                message: `Monthly lead quota exceeded (${currentCount}/${limit}). Upgrade your plan.`,
                quota: { current: currentCount, limit, percentage: '100%' }
            });
        }

        // Warn at 80%
        if (percentage >= 80) {
            req.quotaWarning = {
                message: `⚠️ Lead quota at ${percentage.toFixed(0)}% (${currentCount}/${limit})`,
                percentage: percentage.toFixed(0)
            };
        }

        req.quotaInfo = { current: currentCount, limit, percentage: percentage.toFixed(0) };
        next();
    } catch (err) {
        console.error('[QUOTA CHECK ERROR]:', err.message);
        next(); // Non-blocking on error
    }
};

/**
 * Get Quota Status (for dashboard)
 */
const getQuotaStatus = async (req, res, next) => {
    try {
        const leadsCount = await getCurrentUsage('LEADS');
        const messagesCount = await getCurrentUsage('MESSAGES');

        const leadsPercent = ((leadsCount / QUOTA_LIMITS.LEADS_PER_MONTH) * 100).toFixed(1);
        const msgPercent = ((messagesCount / QUOTA_LIMITS.MESSAGES_PER_MONTH) * 100).toFixed(1);

        res.json({
            success: true,
            data: {
                leads: {
                    current: leadsCount,
                    limit: QUOTA_LIMITS.LEADS_PER_MONTH,
                    percentage: leadsPercent + '%',
                    status: leadsPercent >= 100 ? 'EXCEEDED' : leadsPercent >= 80 ? 'WARNING' : 'OK'
                },
                messages: {
                    current: messagesCount,
                    limit: QUOTA_LIMITS.MESSAGES_PER_MONTH,
                    percentage: msgPercent + '%',
                    status: msgPercent >= 100 ? 'EXCEEDED' : msgPercent >= 80 ? 'WARNING' : 'OK'
                },
                month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { checkLeadQuota, getQuotaStatus, QUOTA_LIMITS, getCurrentUsage };
