const prisma = require('../../config/prisma');

/**
 * @desc    Send mock WhatsApp message
 * @route   POST /api/whatsapp/send
 */
exports.sendMessage = async (req, res, next) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({ success: false, message: 'Phone and message are required' });
        }

        // Mock API call simulation
        console.log(`[WhatsApp Mock] Sending to ${phone}: ${message}`);

        // Record in database
        const recordedMessage = await prisma.whatsappMessage.create({
            data: {
                phone,
                message,
                status: 'Sent'
            }
        });

        res.json({
            success: true,
            message: 'WhatsApp message sent (Mock)',
            data: recordedMessage
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get sent WhatsApp messages logs
 * @route   GET /api/whatsapp/logs
 */
exports.getLogs = async (req, res, next) => {
    try {
        const logs = await prisma.whatsappMessage.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        next(error);
    }
};
