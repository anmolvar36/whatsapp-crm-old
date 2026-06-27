const prisma = require('../../config/prisma');

// @desc    Get all subscriptions/billing data
// @route   GET /api/billing
exports.getSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await prisma.subscription.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json({ success: true, data: subscriptions });
    } catch (error) {
        next(error);
    }
};

// @desc    Upgrade a client plan
// @route   PUT /api/billing/:id/upgrade
exports.upgradePlan = async (req, res, next) => {
    try {
        const { plan } = req.body;
        const subId = parseInt(req.params.id);

        const updated = await prisma.subscription.update({
            where: { id: subId },
            data: {
                plan,
                status: 'Active'
            }
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
};

// @desc    Suspend a client
// @route   PUT /api/billing/:id/suspend
exports.suspendClient = async (req, res, next) => {
    try {
        const subId = parseInt(req.params.id);
        await prisma.subscription.update({
            where: { id: subId },
            data: { status: 'Suspended' }
        });
        res.json({ success: true, message: 'Client subscription suspended' });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new plan/subscription
// @route   POST /api/billing
exports.addSubscription = async (req, res, next) => {
    try {
        const { clientName, name, plan, renewalDate } = req.body;
        const newSub = await prisma.subscription.create({
            data: {
                clientName: clientName || name || 'New Client',
                plan: plan || name || 'Standard',
                renewalDate: renewalDate ? new Date(renewalDate) : null,
                status: 'Active'
            }
        });

        res.status(201).json({ success: true, data: newSub });
    } catch (error) {
        next(error);
    }
};

// @desc    Get invoice by subscription ID
// @route   GET /api/billing/invoice/:id
exports.getInvoice = async (req, res, next) => {
    try {
        const subId = parseInt(req.params.id);
        if (isNaN(subId)) {
            return res.status(400).json({ success: false, message: 'Invalid subscription ID' });
        }

        const subscription = await prisma.subscription.findUnique({
            where: { id: subId }
        });

        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }

        const planPrices = { Enterprise: 1200, Professional: 800, Starter: 200 };
        const basePrice = planPrices[subscription.plan] || 500;

        const invoices = [1, 2, 3].map((i) => ({
            id: `INV-${subId}-${2024 + i - 1}-00${i}`,
            subscriptionId: subId,
            client: subscription.clientName,
            plan: subscription.plan,
            amount: basePrice,
            status: i === 3 ? 'Pending' : 'Paid',
            date: new Date(2024, i - 1, 1).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        }));

        res.json({ success: true, data: invoices });
    } catch (error) {
        next(error);
    }
};

// @desc    Update payment method
// @route   PUT /api/billing/:id/payment-method
exports.updatePaymentMethod = async (req, res, next) => {
    try {
        const subId = parseInt(req.params.id);
        if (isNaN(subId)) {
            return res.status(400).json({ success: false, message: 'Invalid subscription ID' });
        }

        // Simulating a DB update for payment method 
        // In a real app, this would integrate with Stripe/PayPal
        res.json({ success: true, message: 'Secure payment portal link generated uniquely for this client.' });
    } catch (error) {
        next(error);
    }
};
