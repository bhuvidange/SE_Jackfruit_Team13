const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, bearer } = require('./helpers');
const Question = require('../src/models/Question');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearAll);

const mcq = (over = {}) => ({
  type: 'mcq',
  text: 'Which data structure uses FIFO ordering?',
  options: ['Stack', 'Queue', 'Tree', 'Graph'],
  correctAnswer: 1,
  subject: 'Data Structures',
  topic: 'Queues',
  difficulty: 'easy',
  ...over,
});
const tf = (over = {}) => ({
  type: 'tf',
  text: 'A stack is LIFO.',
  correctAnswer: 0,
  subject: 'Data Structures',
  topic: 'Stacks',
  difficulty: 'easy',
  ...over,
});

const post = (token, body) => request(app).post('/api/questions').set(bearer(token)).send(body);

describe('TC-QB-01 instructor adds a question (CSMQP-F-020)', () => {
  test('question is persisted and retrievable', async () => {
    const { token, user } = await createUser('instructor');
    const created = await post(token, mcq());
    expect(created.status).toBe(201);
    expect(created.body.question).toMatchObject({ text: expect.any(String), owner: user.id, status: 'active' });

    const fetched = await request(app).get(`/api/questions/${created.body.question.id}`).set(bearer(token));
    expect(fetched.status).toBe(200);
    expect(fetched.body.question.options).toEqual(['Stack', 'Queue', 'Tree', 'Graph']);
    expect(await Question.countDocuments()).toBe(1);

    const list = await request(app).get('/api/questions').set(bearer(token));
    expect(list.body.questions).toHaveLength(1);
  });

  test('unauthenticated request is refused', async () => {
    expect((await request(app).post('/api/questions').send(mcq())).status).toBe(401);
  });

  test('missing required fields are rejected', async () => {
    const { token } = await createUser('instructor');
    const res = await post(token, { type: 'mcq' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(3);
  });

  test('invalid object id returns 400, unknown id returns 404', async () => {
    const { token } = await createUser('instructor');
    expect((await request(app).get('/api/questions/not-an-id').set(bearer(token))).status).toBe(400);
    expect((await request(app).get('/api/questions/64b000000000000000000001').set(bearer(token))).status).toBe(404);
  });
});

describe('TC-QB-02 MCQ and True/False structure (CSMQP-F-021)', () => {
  let token;
  beforeEach(async () => {
    ({ token } = await createUser('instructor'));
  });

  test('MCQ with exactly 4 options and one correct answer is accepted', async () => {
    expect((await post(token, mcq())).status).toBe(201);
  });

  test.each([3, 5, 0])('MCQ with %i options is rejected', async (n) => {
    const options = Array.from({ length: n }, (_, i) => `Option ${i}`);
    const res = await post(token, mcq({ options }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exactly 4 options/);
  });

  test.each([-1, 4, 1.5, '1', null, [1, 2]])('MCQ with correct answer %p is rejected', async (correctAnswer) => {
    expect((await post(token, mcq({ correctAnswer }))).status).toBe(400);
  });

  test('MCQ with duplicate or blank options is rejected', async () => {
    expect((await post(token, mcq({ options: ['A', 'a', 'B', 'C'] }))).status).toBe(400);
    expect((await post(token, mcq({ options: ['A', ' ', 'B', 'C'] }))).status).toBe(400);
  });

  test('True/False gets default True/False options and accepts index 0 or 1', async () => {
    const res = await post(token, tf());
    expect(res.status).toBe(201);
    expect(res.body.question.options).toEqual(['True', 'False']);
    expect((await post(token, tf({ correctAnswer: 1 }))).status).toBe(201);
  });

  test('True/False with 3 options or an out-of-range answer is rejected', async () => {
    expect((await post(token, tf({ options: ['True', 'False', 'Maybe'] }))).status).toBe(400);
    expect((await post(token, tf({ correctAnswer: 2 }))).status).toBe(400);
  });

  test('unknown type is rejected', async () => {
    expect((await post(token, mcq({ type: 'essay' }))).status).toBe(400);
  });
});

describe('TC-QB-03 tag and filter questions (CSMQP-F-022)', () => {
  test('subject, topic and difficulty tags persist and filter correctly', async () => {
    const { token } = await createUser('instructor');
    await post(token, mcq({ subject: 'Maths', topic: 'Algebra', difficulty: 'hard', text: 'Solve x+1=2' }));
    await post(token, mcq({ subject: 'Maths', topic: 'Geometry', difficulty: 'easy', text: 'Sides of a triangle?' }));
    await post(token, tf({ subject: 'Physics', topic: 'Optics', difficulty: 'medium' }));

    const get = (qs) => request(app).get(`/api/questions?${qs}`).set(bearer(token));
    expect((await get('subject=maths')).body.questions).toHaveLength(2);
    expect((await get('subject=Maths&topic=Algebra')).body.questions).toHaveLength(1);
    expect((await get('difficulty=medium')).body.questions[0].subject).toBe('Physics');
    expect((await get('type=tf')).body.questions).toHaveLength(1);
    expect((await get('q=triangle')).body.questions).toHaveLength(1);
    expect((await get('subject=Chemistry')).body.questions).toHaveLength(0);
  });

  test('regex metacharacters in filters are treated literally', async () => {
    const { token } = await createUser('instructor');
    await post(token, mcq());
    const res = await request(app).get('/api/questions?subject=.*').set(bearer(token));
    expect(res.body.questions).toHaveLength(0);
  });

  test('invalid difficulty on create is rejected', async () => {
    const { token } = await createUser('instructor');
    expect((await post(token, mcq({ difficulty: 'impossible' }))).status).toBe(400);
  });
});

describe('TC-QB-04 edit and delete (CSMQP-F-023)', () => {
  test('edit persists', async () => {
    const { token } = await createUser('instructor');
    const { body } = await post(token, mcq());
    const res = await request(app)
      .put(`/api/questions/${body.question.id}`)
      .set(bearer(token))
      .send(mcq({ text: 'Updated text', correctAnswer: 2, difficulty: 'hard' }));
    expect(res.status).toBe(200);
    const stored = await Question.findById(body.question.id);
    expect(stored).toMatchObject({ text: 'Updated text', correctAnswer: 2, difficulty: 'hard' });
  });

  test('an invalid edit is rejected and leaves the question unchanged', async () => {
    const { token } = await createUser('instructor');
    const { body } = await post(token, mcq());
    const res = await request(app)
      .put(`/api/questions/${body.question.id}`)
      .set(bearer(token))
      .send(mcq({ options: ['A', 'B', 'C'] }));
    expect(res.status).toBe(400);
    expect((await Question.findById(body.question.id)).options).toHaveLength(4);
  });

  test('deleted question no longer appears in the bank', async () => {
    const { token } = await createUser('instructor');
    const { body } = await post(token, mcq());
    const del = await request(app).delete(`/api/questions/${body.question.id}`).set(bearer(token));
    expect(del.status).toBe(200);
    expect((await request(app).get('/api/questions').set(bearer(token))).body.questions).toHaveLength(0);
    expect((await request(app).get(`/api/questions/${body.question.id}`).set(bearer(token))).status).toBe(404);
    expect((await request(app).delete(`/api/questions/${body.question.id}`).set(bearer(token))).status).toBe(404);
  });

  test('another instructor cannot edit or delete the question (403)', async () => {
    const owner = await createUser('instructor');
    const other = await createUser('instructor');
    const { body } = await post(owner.token, mcq());
    const put = await request(app).put(`/api/questions/${body.question.id}`).set(bearer(other.token)).send(mcq({ text: 'Hijacked' }));
    const del = await request(app).delete(`/api/questions/${body.question.id}`).set(bearer(other.token));
    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
    expect((await Question.findById(body.question.id)).text).not.toBe('Hijacked');
  });
});
