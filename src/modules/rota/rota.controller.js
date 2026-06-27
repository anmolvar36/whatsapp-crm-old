const prisma = require('../../config/prisma');

// @desc    Get all rotas
// @route   GET /api/rota
exports.getRotas = async (req, res, next) => {
    try {
        const rotas = await prisma.rota.findMany({
            orderBy: { date: 'desc' }
        });
        res.json({ success: true, data: rotas });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new rota
// @route   POST /api/rota
exports.addRota = async (req, res, next) => {
    try {
        const { date, teamMember, serviceUser, shiftStart, shiftEnd, location, notes, status } = req.body;

        const shiftTime = `${shiftStart} - ${shiftEnd}`;

        const newRota = await prisma.rota.create({
            data: {
                date,
                teamMember,
                serviceUser,
                shiftStart,
                shiftEnd,
                shiftTime,
                location: location || '',
                notes: notes || '',
                status: status || 'Scheduled',
                createdBy: req.user ? req.user.name : 'System'
            }
        });

        res.status(201).json({ success: true, message: 'Rota created successfully', data: newRota });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a rota
// @route   PUT /api/rota/:id
exports.updateRota = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const { date, teamMember, serviceUser, shiftStart, shiftEnd, location, notes, status } = req.body;

        const shiftTime = `${shiftStart} - ${shiftEnd}`;

        const currentRota = await prisma.rota.findUnique({
            where: { id }
        });

        if (!currentRota) {
            return res.status(404).json({ success: false, message: 'Rota not found' });
        }

        const updatedRota = await prisma.rota.update({
            where: { id },
            data: {
                date,
                teamMember,
                serviceUser,
                shiftStart,
                shiftEnd,
                shiftTime,
                location,
                notes,
                status
            }
        });

        res.json({ success: true, message: 'Rota updated successfully', data: updatedRota });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a rota
// @route   DELETE /api/rota/:id
exports.deleteRota = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        const currentRota = await prisma.rota.findUnique({
            where: { id }
        });

        if (!currentRota) {
            return res.status(404).json({ success: false, message: 'Rota not found' });
        }

        await prisma.rota.delete({
            where: { id }
        });

        res.json({ success: true, message: 'Rota deleted successfully', data: null });
    } catch (error) {
        next(error);
    }
};
