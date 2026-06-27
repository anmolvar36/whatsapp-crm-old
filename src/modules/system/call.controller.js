const prisma = require('../../config/prisma');

// @desc    Get all calls
// @route   GET /api/calls
exports.getCalls = async (req, res, next) => {
    try {
        const calls = await prisma.call.findMany({
            include: {
                lead: {
                    select: { name: true, phone: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json({
            success: true,
            message: 'Calls retrieved successfully',
            data: calls
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Log a new call
// @route   POST /api/calls
exports.logCall = async (req, res, next) => {
    try {
        const { leadId, callStatus, duration } = req.body;

        const newCall = await prisma.call.create({
            data: {
                leadId: parseInt(leadId),
                callStatus: callStatus || 'Completed',
                duration: parseInt(duration) || 0
            }
        });

        res.status(201).json({
            success: true,
            message: 'Call logged successfully',
            data: newCall
        });
    } catch (error) {
        next(error);
    }
};
