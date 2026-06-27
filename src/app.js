const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { errorMiddleware } = require('./middleware/error.middleware');

dotenv.config();

const app = express();

// ─────────────────────────────────────────────────
// 🛡️ PRODUCTION SECURITY & LOGGING
// ─────────────────────────────────────────────────

// 1. Secure Headers
app.use(helmet());

// 2. Request Logging (Morgan)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 3. Global Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api/', limiter);

// Standard Middlewares
app.use(cors({
    origin: [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'https://whatsapp-crm.kiaantechnology.com',
        'https://whaatsapp-crm-old.netlify.app'
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/', (req, res) => {
    res.json({ success: true, message: 'CRM Production API is running' });
});

const db = require('./config/database');
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({
            status: "connected",
            database: process.env.DB_NAME || "crm_db"
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

// Auth Routes
const authRoutes = require('./modules/auth/auth.routes');
app.use('/api/auth', authRoutes);

// User Routes
const userRoutes = require('./modules/users/user.routes');
app.use('/api/users', userRoutes);

// Lead Routes
const leadRoutes = require('./modules/leads/lead.routes');
app.use('/api/leads', leadRoutes);

// Dashboard Routes
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
app.use('/api/dashboard', dashboardRoutes);

// Message Routes
const messageRoutes = require('./modules/messages/message.routes');
app.use('/api/messages', messageRoutes);

// Customer Routes
const customerRoutes = require('./modules/customers/customer.routes');
app.use('/api/customers', customerRoutes);

// Billing Routes
const billingRoutes = require('./modules/billing/billing.routes');
app.use('/api/billing', billingRoutes);

// System Routes
const channelRoutes = require('./modules/system/channel.routes');
app.use('/api/channels', channelRoutes);
app.use('/api/channel', channelRoutes);

const analyticsRoutes = require('./modules/system/analytics.routes');
app.use('/api/analytics', analyticsRoutes);

const reportRoutes = require('./modules/system/report.routes');
app.use('/api/reports', reportRoutes);

// Counselor/Support Routes
const counselorRoutes = require('./modules/users/counselor.routes');
app.use('/api/counselor', counselorRoutes);

const supportRoutes = require('./modules/users/support.routes');
app.use('/api/support', supportRoutes);

const callRoutes = require('./modules/system/call.routes');
app.use('/api/calls', callRoutes);

const notificationRoutes = require('./modules/system/notification.routes');
app.use('/api/notifications', notificationRoutes);

const menuRoutes = require('./modules/system/menu.routes');
app.use('/api/system/menus', menuRoutes);

// WhatsApp Routes
const whatsappRoutes = require('./modules/whatsapp/whatsapp.routes');
app.use('/api/whatsapp', whatsappRoutes);

// Admin/Management Routes
const auditRoutes = require('./modules/admin/audit.routes');
app.use('/api/audit', auditRoutes);

const templateRoutes = require('./modules/messages/template.routes');
app.use('/api/templates', templateRoutes);

const routingRoutes = require('./modules/leads/routing.routes');
app.use('/api/routing', routingRoutes);

const aiRoutes = require('./modules/leads/ai.routes');
app.use('/api/ai', aiRoutes);

const adminRoutes = require('./modules/admin/admin.routes');
app.use('/api/admin', adminRoutes);

const careTemplateRoutes = require('./modules/templates/template.routes');
app.use('/api/care-templates', careTemplateRoutes);

const rotaRoutes = require('./modules/rota/rota.routes');
app.use('/api/rota', rotaRoutes);

const superAdminRoutes = require('./modules/admin/superadmin.routes');
app.use('/api/super-admin', superAdminRoutes);

const managerRoutes = require('./modules/admin/manager.routes');
app.use('/api/manager', managerRoutes);

const teamLeaderRoutes = require('./modules/admin/teamleader.routes');
app.use('/api/team-leader', teamLeaderRoutes);

// Global Error Handler
app.use(errorMiddleware);

module.exports = app;
