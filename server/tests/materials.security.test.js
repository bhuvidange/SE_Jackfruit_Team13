const fs = require('fs');
const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, bearer } = require('./helpers');
const config = require('../src/config');

beforeAll(connect);
afterAll(async () => {
  await disconnect();
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
});
afterEach(clearAll);

describe('TC-Sec-04 multipart upload fields are sanitised (CSMQP-SR-004)', () => {
  test('HTML in title, subject and description is stripped', async () => {
    const { token } = await createUser('instructor');
    const res = await request(app)
      .post('/api/materials')
      .set(bearer(token))
      .field('title', 'Notes <script>alert(1)</script>')
      .field('subject', '<b>Networks</b>')
      .field('topic', 'TCP')
      .field('description', '<img src=x onerror=alert(1)>desc')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'n.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.material).toMatchObject({ title: 'Notes alert(1)', subject: 'Networks', description: 'desc' });
  });
});
