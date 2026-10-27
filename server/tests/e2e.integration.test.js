const fs = require('fs');
const request = require('supertest');
const { app, connect, disconnect, clearAll, bearer, PASSWORD } = require('./helpers');
const config = require('../src/config');

beforeAll(connect);
afterAll(async () => {
  await disconnect();
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
});
afterEach(clearAll);

describe('Sprint 1 end-to-end flow (API integration)', () => {
  test('register -> questions -> material -> quiz -> publish -> search/download -> attempt -> result', async () => {
    const api = () => request(app);

    // Registration and login for both roles (TC-Auth-01, TC-Auth-03)
    const reg = (name, email, role) => api().post('/api/auth/register').send({ name, email, password: PASSWORD, role });
    expect((await reg('Ira Instructor', 'ira@uni.test', 'instructor')).status).toBe(201);
    expect((await reg('Sam Student', 'sam@uni.test', 'student')).status).toBe(201);
    const login = async (email) => (await api().post('/api/auth/login').send({ email, password: PASSWORD })).body.token;
    const instructor = await login('ira@uni.test');
    const student = await login('sam@uni.test');

    // Instructor builds the question bank (TC-QB-01/02)
    const questions = [
      { type: 'mcq', text: 'Capital of France?', options: ['Berlin', 'Paris', 'Rome', 'Madrid'], correctAnswer: 1, subject: 'Geography', topic: 'Europe', difficulty: 'easy' },
      { type: 'tf', text: 'The Earth is flat.', correctAnswer: 1, subject: 'Geography', topic: 'Earth', difficulty: 'easy' },
      { type: 'mcq', text: '2 + 2 = ?', options: ['3', '4', '5', '6'], correctAnswer: 1, subject: 'Maths', topic: 'Arithmetic', difficulty: 'easy' },
    ];
    const ids = [];
    for (const body of questions) {
      const res = await api().post('/api/questions').set(bearer(instructor)).send(body);
      expect(res.status).toBe(201);
      ids.push(res.body.question.id);
    }

    // Instructor uploads a material (TC-Mat-01/03)
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1000, 0x20)]);
    const up = await api()
      .post('/api/materials')
      .set(bearer(instructor))
      .field('title', 'Europe study guide')
      .field('subject', 'Geography')
      .field('topic', 'Europe')
      .attach('file', pdf, { filename: 'europe.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);

    // Instructor creates and publishes a quiz (TC-Quiz-01/02/03)
    const created = await api().post('/api/quizzes').set(bearer(instructor)).send({ title: 'Geography quiz', questionIds: ids, timeLimitMinutes: 10 });
    expect(created.status).toBe(201);
    const quizId = created.body.quiz.id;
    expect((await api().post(`/api/quizzes/${quizId}/publish`).set(bearer(instructor))).status).toBe(200);

    // Student searches and downloads the material (TC-Mat-04)
    const found = await api().get('/api/materials?query=europe').set(bearer(student));
    expect(found.body.materials).toHaveLength(1);
    const dl = await api()
      .get(`/api/materials/${found.body.materials[0].id}/download`)
      .set(bearer(student))
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(dl.status).toBe(200);
    expect(dl.body.equals(pdf)).toBe(true);

    // Student sees the quiz, attempts it and submits two right, one wrong (TC-Quiz-03/04/05)
    const available = await api().get('/api/quizzes').set(bearer(student));
    expect(available.body.quizzes.map((x) => x.id)).toEqual([quizId]);
    const started = await api().post(`/api/quizzes/${quizId}/start`).set(bearer(student));
    expect(started.status).toBe(200);
    const [q1, q2, q3] = started.body.quiz.questions;
    const submitted = await api()
      .post(`/api/quizzes/${quizId}/submit`)
      .set(bearer(student))
      .send({ answers: [{ questionId: q1.id, selected: 1 }, { questionId: q2.id, selected: 0 }, { questionId: q3.id, selected: 1 }] });
    expect(submitted.status).toBe(200);
    expect(submitted.body.attempt).toMatchObject({ score: 2, total: 3 });

    // Result with per-question correctness (TC-Quiz-06)
    const result = await api().get(`/api/quizzes/attempts/${submitted.body.attempt.id}`).set(bearer(student));
    expect(result.body.attempt.results.map((r) => r.correct)).toEqual([true, false, true]);

    // The quiz now shows as completed in the student's list, and the question is protected from deletion
    const list = await api().get('/api/quizzes').set(bearer(student));
    expect(list.body.quizzes[0].attempt).toMatchObject({ status: 'submitted', score: 2 });
    expect((await api().delete(`/api/questions/${ids[0]}`).set(bearer(instructor))).status).toBe(409);
  });
});
