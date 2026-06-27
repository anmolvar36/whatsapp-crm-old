const prisma = require('../../config/prisma');

// @desc    Get all customers
// @route   GET /api/customers
exports.getCustomers = async (req, res, next) => {
    try {
        const customers = await prisma.customer.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            message: 'Customers retrieved successfully',
            data: customers
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create customer
// @route   POST /api/customers
exports.createCustomer = async (req, res, next) => {
    try {
        const { name, phone, email, source, funder, carePlan } = req.body;

        const customer = await prisma.customer.create({
            data: {
                name,
                phone,
                email,
                source,
                funder,
                carePlan
            }
        });

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: customer
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
exports.updateCustomer = async (req, res, next) => {
    try {
        const customerId = parseInt(req.params.id);
        const data = req.body;

        const customer = await prisma.customer.update({
            where: { id: customerId },
            data
        });

        res.json({
            success: true,
            message: 'Customer updated successfully',
            data: customer
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        next(error);
    }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
exports.deleteCustomer = async (req, res, next) => {
    try {
        const customerId = parseInt(req.params.id);

        await prisma.customer.delete({
            where: { id: customerId }
        });

        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        next(error);
    }
};
