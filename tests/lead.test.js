const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const jwt = require('jsonwebtoken');

describe('Lead Module API Tests', () => {
    let adminToken;
    let counselorToken;
    let testLeadId;

    beforeAll(async () => {
        // Setup tokens for testing
        adminToken = jwt.sign({ id: 1, role: 'SUPER_ADMIN' }, process.env.JWT_SECRET || 'test_secret');
        counselorToken = jwt.sign({ id: 2, role: 'COUNSELOR' }, process.env.JWT_SECRET || 'test_secret');
    });

    test('POST /api/leads - Should create a new lead with auto-assignment', async () => {
        const response = await request(app)
            .post('/api/leads')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test Automation Lead',
                email: 'test@example.com',
                phone: '1234567890',
                country: 'India',
                program: 'Computer Science'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Test Automation Lead');
        testLeadId = response.body.data.id;
    });

    test('GET /api/leads - Should retrieve leads list', async () => {
        const response = await request(app)
            .get('/api/leads')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('PUT /api/leads/:id - Counselor should NOT update leads assigned to others', async () => {
        // Assume lead 100 is assigned to admin or someone else
        const response = await request(app)
            .put(`/api/leads/${testLeadId}`)
            .set('Authorization', `Bearer ${counselorToken}`)
            .send({ name: 'Hacker Update' });

        // If not assigned to counselor, should return 403
        expect(response.status).toBe(403);
    });

    afterAll(async () => {
        // Cleanup test data
        if (testLeadId) {
            await prisma.lead.delete({ where: { id: testLeadId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });
});
