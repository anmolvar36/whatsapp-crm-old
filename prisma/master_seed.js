const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    console.log('🚀 Starting Enterprise CRM Master Seed...');

    // 1. Clear existing data in reverse order of dependencies
    const models = [
        'submenu', 'menu', 'rolePermission', 'notification', 'counselorNote',
        'call', 'message', 'activity', 'lead', 'leadStatus', 'user', 'role',
        'subscription', 'channel'
    ];

    for (const model of models) {
        try {
            await prisma[model].deleteMany();
        } catch (e) {
            console.log(`⚠️ Skipping clear for ${model} (might not exist yet).`);
        }
    }

    console.log('🧹 Database cleared.');

    // 2. Create Roles
    const rolesData = [
        { name: 'SUPER_ADMIN', description: 'System owner with full access' },
        { name: 'ADMIN', description: 'Institutional administrator' },
        { name: 'MANAGER', description: 'Operational performance monitor' },
        { name: 'TEAM_LEADER', description: 'Team supervisor and lead reassigner' },
        { name: 'COUNSELOR', description: 'Frontline lead handler' },
        { name: 'SUPPORT', description: 'First point of contact and routing' }
    ];

    const roles = {};
    for (const r of rolesData) {
        roles[r.name] = await prisma.role.create({ data: r });
    }
    console.log('✅ Roles established.');

    // 2.5 Create Lead Statuses
    const statusData = [
        { name: 'New', color: '#3B82F6' },
        { name: 'Qualified', color: '#10B981' },
        { name: 'Follow-up', color: '#F59E0B' },
        { name: 'Converted', color: '#8B5CF6' },
        { name: 'Lost', color: '#EF4444' }
    ];

    const statuses = {};
    for (const s of statusData) {
        statuses[s.name] = await prisma.leadStatus.create({ data: s });
    }
    console.log('✅ Lead Statuses established.');

    // 3. Create Default Admin Users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Super Admin
    await prisma.user.create({
        data: {
            name: 'Pova Super Admin',
            email: 'super.admin@crm.com',
            password: hashedPassword,
            roleId: roles['SUPER_ADMIN'].id,
            status: 'Active',
            team: 'Executive Board'
        }
    });

    // Admin
    await prisma.user.create({
        data: {
            name: 'System Admin',
            email: 'admin@edu-corp.com',
            password: hashedPassword,
            roleId: roles['ADMIN'].id,
            status: 'Active',
            team: 'Central Intelligence'
        }
    });

    // Manager
    await prisma.user.create({
        data: {
            name: 'Operations Manager',
            email: 'manager@analytics.crm',
            password: hashedPassword,
            roleId: roles['MANAGER'].id,
            status: 'Active',
            team: 'Alpha Ops'
        }
    });

    // Team Leader
    await prisma.user.create({
        data: {
            name: 'Team Leader X',
            email: 'leader@teams.crm',
            password: hashedPassword,
            roleId: roles['TEAM_LEADER'].id,
            status: 'Active',
            team: 'Alpha Ops'
        }
    });

    // Counselor
    await prisma.user.create({
        data: {
            name: 'Primary Counselor',
            email: 'counselor@sales.crm',
            password: hashedPassword,
            roleId: roles['COUNSELOR'].id,
            status: 'Active',
            team: 'Alpha Ops'
        }
    });

    // Support
    await prisma.user.create({
        data: {
            name: 'Support Agent',
            email: 'support@help.crm',
            password: hashedPassword,
            roleId: roles['SUPPORT'].id,
            status: 'Active',
            team: 'Help Desk'
        }
    });

    console.log('👤 Enterprise Users created (Password: password123).');

    // 4. Create Menus linked to Roles
    const menus = [
        // SUPER_ADMIN
        { label: 'Overview', icon: 'LayoutDashboard', path: '/super-admin', roleId: roles['SUPER_ADMIN'].id, order: 1 },
        { label: 'All Channels Control', icon: 'MessageSquare', path: '/super-admin/channels', roleId: roles['SUPER_ADMIN'].id, order: 2 },
        { label: 'Audit Logs', icon: 'BrainCircuit', path: '/super-admin/audit', roleId: roles['SUPER_ADMIN'].id, order: 3 },

        // ADMIN
        { label: 'Dashboard', icon: 'LayoutDashboard', path: '/admin', roleId: roles['ADMIN'].id, order: 1 },
        { label: 'Channels', icon: 'MessageSquare', path: '/admin/channels', roleId: roles['ADMIN'].id, order: 2 },
        { label: 'Routing Rules', icon: 'Globe', path: '/admin/routing', roleId: roles['ADMIN'].id, order: 3 },
        { label: 'User Management', icon: 'Users', path: '/admin/users', roleId: roles['ADMIN'].id, order: 4 },

        // MANAGER
        { label: 'Performance', icon: 'LayoutDashboard', path: '/manager', roleId: roles['MANAGER'].id, order: 1 },
        { label: 'Lead Funnel', icon: 'PieChart', path: '/manager/funnel', roleId: roles['MANAGER'].id, order: 2 },

        // TEAM_LEADER
        { label: 'Dashboard', icon: 'LayoutDashboard', path: '/team-leader', roleId: roles['TEAM_LEADER'].id, order: 1 },
        { label: 'Assigned Leads', icon: 'Users', path: '/team-leader/leads', roleId: roles['TEAM_LEADER'].id, order: 2 },

        // COUNSELOR
        { label: 'My Leads', icon: 'Users', path: '/counselor', roleId: roles['COUNSELOR'].id, order: 1 },
        { label: 'Unified Inbox', icon: 'Inbox', path: '/inbox', roleId: roles['COUNSELOR'].id, order: 2 },

        // SUPPORT
        { label: 'Unified Inbox', icon: 'Inbox', path: '/inbox', roleId: roles['SUPPORT'].id, order: 1 },
        { label: 'Lead Assignment', icon: 'UserCheck', path: '/support/assign', roleId: roles['SUPPORT'].id, order: 2 }
    ];

    for (const m of menus) {
        await prisma.menu.create({ data: m });
    }
    console.log('📂 Navigation menus mapped to roles.');

    // 5. Create some dummy leads for immediate data visualization
    await prisma.lead.createMany({
        data: [
            { name: 'John Doe', country: 'India', phone: '+919876543210', stage: 'Qualified', statusId: statuses['Qualified'].id, team: 'Alpha', source: 'Website' },
            { name: 'Jane Smith', country: 'India', phone: '+919876543211', stage: 'New', statusId: statuses['New'].id, team: 'Beta', source: 'WhatsApp' },
            { name: 'Robert Brown', country: 'India', phone: '+919876543212', stage: 'Converted', statusId: statuses['Converted'].id, team: 'Alpha', source: 'Facebook' }
        ]
    });

    console.log('📈 Initial lead data generated.');

    // 6. Create Subscriptions (Clients)
    await prisma.subscription.createMany({
        data: [
            { clientName: 'EduCorp Inc.', plan: 'Enterprise', status: 'Active', renewalDate: new Date('2026-12-31'), contactsCount: 1500 },
            { clientName: 'HealthLine', plan: 'Professional', status: 'Active', renewalDate: new Date('2026-06-30'), contactsCount: 850 },
            { clientName: 'Global Connect', plan: 'Basic', status: 'Active', renewalDate: new Date('2026-03-31'), contactsCount: 200 }
        ]
    });
    console.log('💳 Client subscriptions provisioned.');

    // 7. Create Channels
    await prisma.channel.createMany({
        data: [
            { name: 'Official WhatsApp', type: 'WhatsApp', status: 'Active', country: 'India', usage_count: 540 },
            { name: 'FB Admissions Page', type: 'Facebook', status: 'Active', country: 'USA', usage_count: 210 },
            { name: 'Website Main Widget', type: 'Website', status: 'Active', country: 'UK', usage_count: 1250 },
            { name: 'Instagram Support', type: 'Instagram', status: 'Inactive', country: 'Italy', usage_count: 0 }
        ]
    });
    console.log('📡 Communication channels integrated.');

    console.log('✨ Master Seed Successful.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
