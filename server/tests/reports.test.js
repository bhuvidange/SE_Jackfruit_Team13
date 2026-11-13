const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, bearer } = require('./helpers');
const Material = require('../src/models/Material');
const Report = require('../src/models/Report');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearAll);

const MISSING_ID = '507f1f77bcf86cd799439011';

const question = (n = 1) => ({
  type: 'mcq',
  text: `Question ${n}`,
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 0,
  subject: 'General',
  topic: 'Mixed',
  difficulty: 'easy',
});

async function newMaterial(owner) {
  return Material.create({
    owner,
    title: 'Offensive notes',
    subject: 'Networks',
    topic: 'TCP',
    originalName: 'notes.pdf',
    format: 'pdf',
    mimeType: 'application/pdf',
    size: 100,
    storedName: 'stored-file.pdf',
  });
}

async function newQuestion(token, n = 1) {
  return (await request(app).post('/api/questions').set(bearer(token)).send(question(n))).body.question;
}

const report = (token, body) => request(app).post('/api/reports').set(bearer(token)).send(body);
const list = (token, query = {}) => request(app).get('/api/reports').query(query).set(bearer(token));
const resolve = (token, id, action) => request(app).patch(`/api/reports/${id}/${action}`).set(bearer(token));

/** An instructor owning a material and a question, plus two students and an admin. */
async function setup() {
  const instructor = await createUser('instructor');
  const student = await createUser('student');
  const student2 = await createUser('student');
  const admin = await createUser('admin');
  const material = await newMaterial(instructor.user.id);
  const q = await newQuestion(instructor.token);
  return { instructor, student, student2, admin, material, q };
}

describe('TC-Admin-02 reporting content (CSMQP-F-051)', () => {
  test('TC-Admin-02 a student reports a material', async () => {
    const { student, material } = await setup();
    const res = await report(student.token, { targetType: 'material', targetId: material.id, reason: '  Inappropriate content  ' });
    expect(res.status).toBe(201);
    expect(res.body.report).toMatchObject({ targetType: 'material', target: material.id, reason: 'Inappropriate content', status: 'open', reporter: student.user.id });
  });

  test('TC-Admin-02 a student reports a question', async () => {
    const { student, q } = await setup();
    const res = await report(student.token, { targetType: 'question', targetId: q.id, reason: 'Wrong and offensive' });
    expect(res.status).toBe(201);
    expect(res.body.report).toMatchObject({ targetType: 'question', target: q.id, status: 'open' });
  });

  test.each([
    ['bad type', { targetType: 'quiz' }],
    ['missing type', { targetType: undefined }],
    ['prototype key as type', { targetType: 'constructor' }],
    ['malformed id', { targetId: 'nope' }],
    ['missing id', { targetId: undefined }],
    ['missing reason', { reason: undefined }],
    ['blank reason', { reason: '   ' }],
    ['non-string reason', { reason: 42 }],
    ['reason over 500 characters', { reason: 'x'.repeat(501) }],
  ])('TC-Admin-02 validation: %s -> 400', async (name, patch) => {
    const { student, material } = await setup();
    const res = await report(student.token, { targetType: 'material', targetId: material.id, reason: 'Spam', ...patch });
    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(expect.any(String));
  });

  test('TC-Admin-02 a 500 character reason is accepted', async () => {
    const { student, material } = await setup();
    const res = await report(student.token, { targetType: 'material', targetId: material.id, reason: 'x'.repeat(500) });
    expect(res.status).toBe(201);
  });

  test('TC-Admin-02 unknown or already removed target -> 404', async () => {
    const { student, instructor, material } = await setup();
    expect((await report(student.token, { targetType: 'material', targetId: MISSING_ID, reason: 'Spam' })).status).toBe(404);
    expect((await report(student.token, { targetType: 'question', targetId: MISSING_ID, reason: 'Spam' })).status).toBe(404);
    await request(app).delete(`/api/materials/${material.id}`).set(bearer(instructor.token));
    expect((await report(student.token, { targetType: 'material', targetId: material.id, reason: 'Spam' })).status).toBe(404);
  });

  test('TC-Admin-02 the same user cannot report the same item twice while open; others can', async () => {
    const { student, student2, material } = await setup();
    const body = { targetType: 'material', targetId: material.id, reason: 'Spam' };
    expect((await report(student.token, body)).status).toBe(201);
    const dup = await report(student.token, body);
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/already reported/i);
    expect((await report(student2.token, body)).status).toBe(201);
  });

  test('TC-Admin-02 a user can report again after their report was dismissed', async () => {
    const { student, admin, material } = await setup();
    const body = { targetType: 'material', targetId: material.id, reason: 'Spam' };
    const first = await report(student.token, body);
    await resolve(admin.token, first.body.report.id, 'dismiss');
    expect((await report(student.token, body)).status).toBe(201);
  });

  test('TC-Admin-02 reporting requires a token', async () => {
    const { material } = await setup();
    const res = await request(app).post('/api/reports').send({ targetType: 'material', targetId: material.id, reason: 'Spam' });
    expect(res.status).toBe(401);
  });
});

describe('TC-Admin-02 admin report list', () => {
  test('TC-Admin-02 lists open reports newest first with reporter name and target summary', async () => {
    const { student, student2, admin, material, q } = await setup();
    await report(student.token, { targetType: 'material', targetId: material.id, reason: 'First' });
    await report(student2.token, { targetType: 'question', targetId: q.id, reason: 'Second' });
    const res = await list(admin.token);
    expect(res.status).toBe(200);
    expect(res.body.reports.map((r) => r.reason)).toEqual(['Second', 'First']);
    expect(res.body.reports[0]).toMatchObject({ reporterName: 'Test student', targetSummary: { text: 'Question 1', subject: 'General' } });
    expect(res.body.reports[1]).toMatchObject({ targetType: 'material', targetSummary: { title: 'Offensive notes', subject: 'Networks' } });
    expect(res.body.reports[1]).not.toHaveProperty('_id');
  });

  test('TC-Admin-02 long question text is shortened in the summary', async () => {
    const { instructor, student, admin } = await setup();
    const long = await request(app).post('/api/questions').set(bearer(instructor.token)).send({ ...question(2), text: 'y'.repeat(300) });
    await report(student.token, { targetType: 'question', targetId: long.body.question.id, reason: 'Too long' });
    const { reports } = (await list(admin.token)).body;
    expect(reports[0].targetSummary.text.length).toBeLessThanOrEqual(120);
    expect(reports[0].targetSummary.text.endsWith('...')).toBe(true);
  });

  test('TC-Admin-02 status filter, default open, and invalid status', async () => {
    const { student, admin, material } = await setup();
    const created = await report(student.token, { targetType: 'material', targetId: material.id, reason: 'Spam' });
    await resolve(admin.token, created.body.report.id, 'dismiss');
    expect((await list(admin.token)).body.reports).toHaveLength(0);
    expect((await list(admin.token, { status: 'dismissed' })).body.reports).toHaveLength(1);
    expect((await list(admin.token, { status: 'bogus' })).status).toBe(400);
    expect((await request(app).get('/api/reports?status=open&status=removed').set(bearer(admin.token))).status).toBe(400);
  });

  test('TC-Admin-02 survives a deleted reporter and a deleted target', async () => {
    const { student, admin, material } = await setup();
    await report(student.token, { targetType: 'material', targetId: material.id, reason: 'Spam' });
    await request(app).delete(`/api/admin/users/${student.user.id}`).set(bearer(admin.token));
    await Material.deleteOne({ _id: material.id });
    const { reports } = (await list(admin.token)).body;
    expect(reports[0]).toMatchObject({ reporterName: 'Unknown user', targetSummary: null });
  });
});

describe('TC-Admin-02 remove', () => {
  test('TC-Admin-02 removing a reported material hides it from the material search', async () => {
    const { student, student2, admin, material } = await setup();
    const a = await report(student.token, { targetType: 'material', targetId: material.id, reason: 'Spam' });
    const b = await report(student2.token, { targetType: 'material', targetId: material.id, reason: 'Also spam' });
    const before = await request(app).get('/api/materials').query({ query: 'Offensive' }).set(bearer(student.token));
    expect(before.body.materials).toHaveLength(1);

    const res = await resolve(admin.token, a.body.report.id, 'remove');
    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ status: 'removed', resolvedBy: admin.user.id });
    expect(res.body.report.resolvedAt).toBeDefined();

    const after = await request(app).get('/api/materials').query({ query: 'Offensive' }).set(bearer(student.token));
    expect(after.body.materials).toHaveLength(0);
    expect((await request(app).get(`/api/materials/${material.id}`).set(bearer(student.token))).status).toBe(404);
    // the other open report on the same item was resolved too
    expect((await Report.findById(b.body.report.id)).status).toBe('removed');
    expect((await list(admin.token)).body.reports).toHaveLength(0);
  });

  test('TC-Admin-02 removing a reported question hides it from the question bank list', async () => {
    const { student, admin, q } = await setup();
    const created = await report(student.token, { targetType: 'question', targetId: q.id, reason: 'Offensive' });
    expect((await resolve(admin.token, created.body.report.id, 'remove')).status).toBe(200);
    const bank = await request(app).get('/api/questions').set(bearer(admin.token));
    expect(bank.body.questions.map((x) => x.id)).not.toContain(q.id);
  });

  test('TC-Admin-02 a question used in a published quiz cannot be removed (409)', async () => {
    const { instructor, student, admin, q } = await setup();
    const quiz = await request(app).post('/api/quizzes').set(bearer(instructor.token)).send({ title: 'Quiz', questionIds: [q.id], timeLimitMinutes: 10 });
    await request(app).post(`/api/quizzes/${quiz.body.quiz.id}/publish`).set(bearer(instructor.token));
    const created = await report(student.token, { targetType: 'question', targetId: q.id, reason: 'Offensive' });
    const res = await resolve(admin.token, created.body.report.id, 'remove');
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/published quiz/i);
    expect((await Report.findById(created.body.report.id)).status).toBe('open');
    const bank = await request(app).get('/api/questions').set(bearer(admin.token));
    expect(bank.body.questions.map((x) => x.id)).toContain(q.id);
    // it can still be dismissed
    expect((await resolve(admin.token, created.body.report.id, 'dismiss')).status).toBe(200);
  });
});

describe('TC-Admin-02 dismiss', () => {
  test('TC-Admin-02 dismissing keeps the item visible', async () => {
    const { student, admin, material } = await setup();
    const created = await report(student.token, { targetType: 'material', targetId: material.id, reason: 'Not sure' });
    const res = await resolve(admin.token, created.body.report.id, 'dismiss');
    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ status: 'dismissed', resolvedBy: admin.user.id });
    const search = await request(app).get('/api/materials').query({ query: 'Offensive' }).set(bearer(student.token));
    expect(search.body.materials).toHaveLength(1);
  });
});

describe('TC-Admin-02 access control and errors', () => {
  test('TC-Admin-02 students and instructors get 403 on admin report routes', async () => {
    const { student, instructor, material } = await setup();
    const created = await report(student.token, { targetType: 'material', targetId: material.id, reason: 'Spam' });
    const id = created.body.report.id;
    for (const { token } of [student, instructor]) {
      expect((await list(token)).status).toBe(403);
      expect((await resolve(token, id, 'remove')).status).toBe(403);
      expect((await resolve(token, id, 'dismiss')).status).toBe(403);
    }
    expect((await Report.findById(id)).status).toBe('open');
  });

  test('TC-Admin-02 no token -> 401 on every report route', async () => {
    expect((await request(app).get('/api/reports')).status).toBe(401);
    expect((await request(app).patch(`/api/reports/${MISSING_ID}/remove`)).status).toBe(401);
    expect((await request(app).patch(`/api/reports/${MISSING_ID}/dismiss`)).status).toBe(401);
  });

  test('TC-Admin-02 unknown or malformed report id -> 404', async () => {
    const { admin } = await setup();
    for (const action of ['remove', 'dismiss']) {
      expect((await resolve(admin.token, MISSING_ID, action)).status).toBe(404);
      expect((await resolve(admin.token, 'not-an-id', action)).status).toBe(404);
    }
  });

  test('TC-Admin-02 an already resolved report -> 409', async () => {
    const { student, admin, material } = await setup();
    const created = await report(student.token, { targetType: 'material', targetId: material.id, reason: 'Spam' });
    const id = created.body.report.id;
    expect((await resolve(admin.token, id, 'dismiss')).status).toBe(200);
    expect((await resolve(admin.token, id, 'dismiss')).status).toBe(409);
    expect((await resolve(admin.token, id, 'remove')).status).toBe(409);
  });
});
