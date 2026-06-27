const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
    logger.error('API Request Error', err, { path: req.path, user: req.user?.id });

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Prisma Specific Error Handling
    if (err.code === 'P2002') {
        statusCode = 400;
        message = `Unique constraint failed on field: ${err.meta?.target || 'unknown'}`;
    } else if (err.code === 'P2003') {
        statusCode = 400;
        message = 'Foreign key constraint failed. Related record not found.';
    } else if (err.code === 'P2025') {
        statusCode = 404;
        message = 'Record to update/delete not found.';
    }

    res.status(statusCode).json({
        success: false,
        message,
        data: null,
        error_code: err.code || 'SYSTEM_ERROR',
        stack: process.env.NODE_ENV === 'production' ? '🛡️ Protected' : err.stack
    });
};

module.exports = { errorMiddleware };
