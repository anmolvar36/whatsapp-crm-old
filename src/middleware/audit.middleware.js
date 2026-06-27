const prisma = require('../config/prisma');

/**
 * Global Audit Logging Middleware
 * Logs all mutation requests (POST, PUT, DELETE) to the activity_logs table.
 */
const auditLog = (action, module) => {
    return async (req, res, next) => {
        const originalSend = res.send;

        res.send = function (data) {
            res.send = originalSend;
            
            // Only log successful or specifically tracked actions
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const userId = req.user?.id || null;
                const details = `Action: ${action} | Method: ${req.method} | Path: ${req.originalUrl} | Body: ${JSON.stringify(req.body)}`;
                
                // Fire and forget logging
                prisma.activityLog.create({
                    data: {
                        userId,
                        action,
                        module,
                        details: details.substring(0, 1000), // Prevent too long details
                        status: 'Success',
                        ip: req.ip,
                        device: req.headers['user-agent']
                    }
                }).catch(err => console.error('[AUDIT LOG ERROR]:', err.message));
            }

            return res.send(data);
        };

        next();
    };
};

module.exports = { auditLog };
