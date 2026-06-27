const prisma = require('../../config/prisma');
const { exportAll } = require('../../../scripts/export_db');

// @desc    Get all channels
// @route   GET /api/channels
exports.getChannels = async (req, res, next) => {
    try {
        const { type } = req.query;
        const whereClause = type ? { type } : {};
        const channels = await prisma.channel.findMany({
            where: whereClause,
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json({ success: true, data: channels });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle channel status
// @route   PUT /api/channels/:id/toggle
exports.toggleChannel = async (req, res, next) => {
    try {
        const channelId = parseInt(req.params.id);
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { status: true }
        });

        if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

        const newStatus = channel.status === 'Active' ? 'Inactive' : 'Active';
        await prisma.channel.update({
            where: { id: channelId },
            data: { status: newStatus }
        });

        await exportAll();
        res.json({ success: true, status: newStatus });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new channel
// @route   POST /api/channels
exports.addChannel = async (req, res, next) => {
    try {
        const { name, type, number, country, webhook, config } = req.body;
        const newChannel = await prisma.channel.create({
            data: {
                name: name || number || 'New Node',
                type,
                number,
                country,
                webhook,
                config: config || {},
                status: 'Active'
            }
        });

        await exportAll();
        res.status(201).json({ success: true, data: newChannel });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete channel
// @route   DELETE /api/channels/:id
exports.deleteChannel = async (req, res, next) => {
    try {
        const channelId = parseInt(req.params.id);
        await prisma.channel.delete({
            where: { id: channelId }
        });
        await exportAll();
        res.json({ success: true, message: 'Channel deleted successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Channel not found' });
        }
        next(error);
    }
};
