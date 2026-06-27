const prisma = require('../../config/prisma');
const socketManager = require('../../sockets/socketManager');

// @desc    Get all chats (grouped by lead)
// @route   GET /api/messages
exports.getChats = async (req, res, next) => {
    try {
        const leadWhere = { ...req.leadScope };
        const leads = await prisma.lead.findMany({
            where: leadWhere,
            include: {
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        const chats = leads
            .filter(l => l.messages.length > 0)
            .map(l => ({
                id: l.id,
                name: l.name,
                phone: l.phone,
                country: l.country,
                stage: l.stage,
                lastMessage: l.messages[0]?.message || '',
                lastTime: l.messages[0]?.timestamp,
                channel: l.messages[0]?.channel || 'WhatsApp',
                unread: l.messages.filter(m => !m.isRead).length,
                assignedTo: l.assignedTo
            }));

        res.json({ success: true, data: chats });
    } catch (error) {
        next(error);
    }
};

// @desc    Get messages for a lead
// @route   GET /api/messages/:leadId
exports.getMessages = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.leadId);
        const messages = await prisma.message.findMany({
            where: { leadId },
            orderBy: { timestamp: 'asc' }
        });

        res.json({
            success: true,
            message: 'Messages retrieved successfully',
            data: messages
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Send a message
// @route   POST /api/messages
exports.sendMessage = async (req, res, next) => {
    try {
        const { leadId, channel, message, sender } = req.body;
        const agentId = sender !== 'lead' && req.user ? req.user.id : null;

        const newMessage = await prisma.message.create({
            data: {
                leadId: parseInt(leadId),
                channel,
                message,
                sender,
                agentId
            }
        });

        // SLA Tracking: Check if this is the first counselor response
        if (sender !== 'lead') {
            const previousMessages = await prisma.message.count({
                where: { 
                    leadId: parseInt(leadId), 
                    sender: { not: 'lead' },
                    id: { not: newMessage.id }
                }
            });

            if (previousMessages === 0) {
                const { trackSLA } = require('../../middleware/sla.middleware');
                await trackSLA(parseInt(leadId), 'FIRST_RESPONSE', req.user?.id);
            }
        }

        // Emit real-time socket events
        socketManager.events.messageNew(newMessage);

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/clear/:chatId  
exports.clearUnread = async (req, res, next) => {
    try {
        const leadId = parseInt(req.params.chatId);
        await prisma.message.updateMany({
            where: { leadId, isRead: false },
            data: { isRead: true }
        });

        res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
        next(error);
    }
};
