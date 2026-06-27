const prisma = require('../config/prisma');

/**
 * SLA Tracking Middleware & Utilities
 *
 * Tracks:
 * - First response time (when counselor first replies)
 * - Resolution time (when lead is Converted/Lost)
 * - SLA breach alerts (if > thresholds)
 */

// SLA Thresholds (in minutes)
const SLA_THRESHOLDS = {
    FIRST_RESPONSE: 60,   // 1 hour for first response
    RESOLUTION: 2880,      // 48 hours for resolution
};

/**
 * Track SLA on lead update
 * Call this whenever a lead stage changes or a reply is sent
 */
const trackSLA = async (leadId, event, userId) => {
    try {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { createdAt: true, stage: true }
        });

        if (!lead) return;

        const now = new Date();
        const createdAt = new Date(lead.createdAt);
        const elapsedMinutes = Math.floor((now - createdAt) / 60000);

        let slaStatus = 'Within SLA';
        let breached = false;

        if (event === 'FIRST_RESPONSE') {
            breached = elapsedMinutes > SLA_THRESHOLDS.FIRST_RESPONSE;
            slaStatus = breached ? `⚠️ BREACH: ${elapsedMinutes}min (limit: ${SLA_THRESHOLDS.FIRST_RESPONSE}min)` : `OK: ${elapsedMinutes}min`;
        } else if (event === 'RESOLUTION') {
            breached = elapsedMinutes > SLA_THRESHOLDS.RESOLUTION;
            slaStatus = breached ? `⚠️ BREACH: ${elapsedMinutes}min (limit: ${SLA_THRESHOLDS.RESOLUTION}min)` : `OK: ${elapsedMinutes}min`;
        }

        // Log SLA event to activity_logs
        await prisma.activityLog.create({
            data: {
                userId: userId || null,
                action: `SLA_${event}`,
                module: 'sla',
                details: `Lead ID ${leadId} | ${event} | Elapsed: ${elapsedMinutes}min | Status: ${slaStatus}`,
                status: breached ? 'Failed' : 'Success'
            }
        });

        if (breached) {
            console.warn(`[SLA BREACH] Lead ${leadId} - ${event} took ${elapsedMinutes}min (limit: ${SLA_THRESHOLDS[event]}min)`);
        }

        return { breached, elapsedMinutes, slaStatus };
    } catch (err) {
        console.error('[SLA TRACK ERROR]:', err.message);
    }
};

/**
 * GET SLA Report for Manager Dashboard
 */
const getSLAReport = async (req, res, next) => {
    try {
        const slaLogs = await prisma.activityLog.findMany({
            where: { module: 'sla' },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        const breaches = slaLogs.filter(l => l.status === 'Failed');
        const onTime = slaLogs.filter(l => l.status === 'Success');

        res.json({
            success: true,
            data: {
                totalTracked: slaLogs.length,
                breaches: breaches.length,
                onTime: onTime.length,
                breachRate: slaLogs.length > 0
                    ? ((breaches.length / slaLogs.length) * 100).toFixed(1) + '%'
                    : '0%',
                thresholds: SLA_THRESHOLDS,
                recentBreaches: breaches.slice(0, 10)
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { trackSLA, getSLAReport, SLA_THRESHOLDS };
