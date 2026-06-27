/**
 * CRM Enterprise Dummy Database
 * Initial state for the simulation layer.
 */

const data = {
    users: [
        { id: 1, name: "Super Admin", email: "admin@crm.com", role: "SUPER_ADMIN", status: "Active" },
        { id: 2, name: "Counselor One", email: "c1@crm.com", role: "COUNSELOR", status: "Active" },
        { id: 3, name: "Support Team", email: "support@crm.com", role: "SUPPORT", status: "Active" }
    ],
    leads: [
        { id: 1, name: "Rahul Sharma", email: "rahul@example.com", phone: "+919876543210", country: "India", status: "New", stage: "Init Response", counselor: "Counselor One", team: "Sales A", type: "WhatsApp", createdAt: new Date().toISOString() },
        { id: 2, name: "Amit Patel", email: "amit@example.com", phone: "+918877665544", country: "India", status: "Qualified", stage: "Intent Sync", counselor: "Counselor One", team: "Sales B", type: "Facebook", createdAt: new Date().toISOString() },
        { id: 3, name: "Sarah Connor", email: "sarah@example.com", phone: "+1234567890", country: "USA", status: "New", stage: "Qualification", counselor: "Support Team", team: "International", type: "Website", createdAt: new Date().toISOString() }
    ],
    messages: [
        { id: 1, leadId: 1, sender: "Lead", text: "Hello, I'm interested in the services.", timestamp: new Date().toISOString() },
        { id: 2, leadId: 1, sender: "System", text: "Welcome! A counselor will be with you shortly.", timestamp: new Date().toISOString() }
    ],
    channels: [
        { id: 1, name: "WhatsApp Main", type: "WhatsApp", status: "Active", connections: 120 },
        { id: 2, name: "Facebook Business", type: "Facebook", status: "Active", connections: 45 },
        { id: 3, name: "Website Portal", type: "Website", status: "Active", connections: 89 }
    ],
    routingRules: [
        { id: 1, country: "India", team: "Sales India", counselor: "Rahul", type: "Round Robin", status: "Active" },
        { id: 2, country: "USA", team: "Global Support", counselor: "Sarah", type: "Direct", status: "Active" }
    ],
    dashboardStats: {
        connectedWhatsapp: 12,
        facebookPages: 5,
        websiteLeads: 128,
        aiStatus: { enabled: true, lastUpdated: new Date().toLocaleString() }
    },
    notifications: [
        { id: 1, title: "New Lead Assigned", message: "Rahul Sharma assigned to you.", type: "Info", unread: true },
        { id: 2, title: "System Update", message: "AI Model v4.5 deployed.", type: "Success", unread: false }
    ]
};

module.exports = data;
