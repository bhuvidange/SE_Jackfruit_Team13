const jwt = require('jsonwebtoken');
const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, bearer, PASSWORD } = require('./helpers');
const User = require('../src/models/User');
const Question = require('../src/models/Question');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearAll);

const question = {
  type: 'mcq',
  text: 'Sample question',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 0,
  subject: 'S',
  topic: 'T',
  difficulty: 'easy',
};

describe('TC-Auth-05 student calls instructor/admin-only API (CSMQP-F-003)', () => {
  test('student gets 403 on question bank read and write', async () => {
    const { token } = await createUser('student');
    expect((await request(app).get('/api/questions').set(bearer(token))).status).toBe(403);
    expect((await request(app).post('/api/questions').set(bearer(token)).send(question)).status).toBe(403);
  });

  test('instructor is allowed; admin may read but not write the question bank', async () => {
    const instructor = await createUser('instructor');
    const admin = await createUser('admin');
    expect((await request(app).post('/api/questions').set(bearer(instructor.token)).send(question)).status).toBe(201);
    expect((await request(app).get('/api/questions').set(bearer(admin.token))).status).toBe(200);
    expect((await request(app).post('/api/questions').set(bearer(admin.token)).send(question)).status).toBe(403);
  });
});

describe('TC-Sec-01 passwords are stored only as salted hashes (CSMQP-SR-001)', () => {
  test('stored value is a bcrypt hash, not the plaintext, and differs per user', async () => {
    await createUser('student', 'one@test.com');
    await createUser('student', 'two@test.com');
    const rows = await User.collection.find({}).toArray();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
      expect(JSON.stringify(row)).not.toContain(PASSWORD);
      expect(row.password).toBeUndefined();
    }
    expect(rows[0].passwordHash).not.toBe(rows[1].passwordHash); // same password, different salt
  });

  test('API responses never include the hash', async () => {
    const { token } = await createUser('student');
    const me = await request(app).get('/api/auth/me').set(bearer(token));
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});

describe('TC-Sec-02 expired or tampered JWT is rejected (CSMQP-SR-002)', () => {
  const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

  test('expired token returns 401', async () => {
    const { user } = await createUser('student');
    const expired = jwt.sign({ sub: user.id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await me(expired);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  test('token just inside its lifetime is accepted', async () => {
    const { user } = await createUser('student');
    const fresh = jwt.sign({ sub: user.id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: 60 });
    expect((await me(fresh)).status).toBe(200);
  });

  test('tampered signature returns 401', async () => {
    const { token } = await createUser('student');
    const [h, p, s] = token.split('.');
    const flipped = s.slice(0, -2) + (s.endsWith('AA') ? 'BB' : 'AA');
    expect((await me(`${h}.${p}.${flipped}`)).status).toBe(401);
  });

  test('tampered payload (role escalation) returns 401', async () => {
    const { token } = await createUser('student');
    const [h, p, s] = token.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    payload.role = 'admin';
    const forged = `${h}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${s}`;
    expect((await me(forged)).status).toBe(401);
  });

  test('token signed with a different secret returns 401', async () => {
    const { user } = await createUser('student');
    expect((await me(jwt.sign({ sub: user.id }, 'attacker-secret'))).status).toBe(401);
  });

  test('alg=none token returns 401', async () => {
    const { user } = await createUser('student');
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    expect((await me(`${enc({ alg: 'none', typ: 'JWT' })}.${enc({ sub: user.id })}.`)).status).toBe(401);
  });

  test.each(['', 'garbage', 'a.b.c'])('malformed token %p returns 401', async (t) => {
    expect((await me(t || 'x')).status).toBe(401);
  });

  test('non-Bearer scheme returns 401', async () => {
    const { token } = await createUser('student');
    expect((await request(app).get('/api/auth/me').set('Authorization', `Basic ${token}`)).status).toBe(401);
  });

  test('valid token for a deleted user returns 401', async () => {
    const { token, user } = await createUser('student');
    await User.deleteOne({ _id: user.id });
    expect((await me(token)).status).toBe(401);
  });
});

describe('TC-Sec-03 student cannot write instructor-owned questions (CSMQP-SR-003)', () => {
  test('student PUT/DELETE returns 403 and data is unchanged', async () => {
    const instructor = await createUser('instructor');
    const student = await createUser('student');
    const { body } = await request(app).post('/api/questions').set(bearer(instructor.token)).send(question);
    const id = body.question.id;

    const put = await request(app).put(`/api/questions/${id}`).set(bearer(student.token)).send({ ...question, text: 'Changed' });
    const del = await request(app).delete(`/api/questions/${id}`).set(bearer(student.token));
    expect(put.status).toBe(403);
    expect(del.status).toBe(403);

    const stored = await Question.findById(id);
    expect(stored.text).toBe('Sample question');
    expect(stored.status).toBe('active');
  });
});

describe('TC-Sec-04 injection payloads are neutralised (CSMQP-SR-004)', () => {
  test('NoSQL injection on login: operator objects are rejected', async () => {
    await createUser('student', 'victim@test.com');
    const attempts = [
      { email: { $gt: '' }, password: { $gt: '' } },
      { email: 'victim@test.com', password: { $ne: 'x' } },
      { email: { $regex: '.*' }, password: PASSWORD },
    ];
    for (const body of attempts) {
      const res = await request(app).post('/api/auth/login').send(body);
      expect([400, 401]).toContain(res.status);
      expect(res.body.token).toBeUndefined();
    }
  });

  test('NoSQL injection through query-string filters: operators are ignored, not applied', async () => {
    const { token } = await createUser('instructor');
    await request(app).post('/api/questions').set(bearer(token)).send(question);
    // If $ne were honoured this would exclude the only question (subject "S"); $regex would match everything.
    const ne = await request(app).get('/api/questions?subject[$ne]=S').set(bearer(token));
    expect(ne.status).toBe(200);
    expect(ne.body.questions).toHaveLength(1);
    const rx = await request(app).get('/api/questions?subject=Nothing&topic[$regex]=.*').set(bearer(token));
    expect(rx.body.questions).toHaveLength(0);
  });

  test('operator keys inside a stored document are dropped', async () => {
    const { token } = await createUser('instructor');
    const res = await request(app)
      .post('/api/questions')
      .set(bearer(token))
      .send({ ...question, $set: { status: 'removed' }, 'owner.x': 1, __proto__: { polluted: true } });
    expect(res.status).toBe(201);
    expect(res.body.question.status).toBe('active');
    expect({}.polluted).toBeUndefined();
  });

  test('XSS payloads are stripped from stored text', async () => {
    const { token } = await createUser('instructor');
    const res = await request(app)
      .post('/api/questions')
      .set(bearer(token))
      .send({
        ...question,
        text: 'What is 2+2? <script>alert(1)</script><img src=x onerror=alert(1)>',
        subject: '<b onmouseover=alert(1)>Maths</b>',
        topic: '<img src=x onerror=alert(1)>Algebra',
        options: ['<svg/onload=alert(1)>4', 'javascript:alert(1)', 'C', 'D'],
      });
    expect(res.status).toBe(201);
    const stored = await Question.findById(res.body.question.id);
    const blob = JSON.stringify(stored.toObject());
    expect(blob).not.toMatch(/<script|<img|<svg|<b |onerror=alert\(1\)>|javascript:/i);
    expect(stored.subject).toBe('Maths');
    expect(stored.topic).toBe('Algebra');
  });

  test('plain comparisons such as "a < b" survive sanitising', async () => {
    const { token } = await createUser('instructor');
    const res = await request(app).post('/api/questions').set(bearer(token)).send({ ...question, text: 'Is 3 < 5 and 7 > 2?' });
    expect(res.body.question.text).toBe('Is 3 < 5 and 7 > 2?');
  });

  test('passwords are not altered by the sanitiser', async () => {
    const password = 'Pa<b>ss1word$';
    await request(app).post('/api/auth/register').send({ name: 'Sym', email: 'sym@test.com', password });
    const res = await request(app).post('/api/auth/login').send({ email: 'sym@test.com', password });
    expect(res.status).toBe(200);
  });

  test('CSRF: cookies alone never authenticate - the JWT must be in the Authorization header', async () => {
    const { token } = await createUser('instructor');
    const res = await request(app)
      .post('/api/questions')
      .set('Cookie', [`token=${token}`, `jwt=${token}`])
      .send(question);
    expect(res.status).toBe(401);
    expect(await Question.countDocuments()).toBe(0);
  });
});

describe('TC-Sec-05 transport security (CSMQP-SR-005)', () => {
  test('API sends HSTS and hardening headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d{7,}/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  // TLS 1.2+ itself is terminated by the deployment (reverse proxy / hosting platform);
  // see docs/sprint-1/DEVIATIONS.md. It cannot be exercised against an in-process Express app.
});
