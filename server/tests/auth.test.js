const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, bearer, PASSWORD } = require('./helpers');
const User = require('../src/models/User');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearAll);

const valid = { name: 'Asha', email: 'asha@test.com', password: PASSWORD, role: 'student' };

describe('TC-Auth-01 register with valid unique email/password (CSMQP-F-001)', () => {
  test('creates the user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: 'asha@test.com', role: 'student', status: 'active' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(await User.countDocuments({ email: 'asha@test.com' })).toBe(1);
  });

  test('email is normalised to lower case and trimmed', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, email: '  ASHA@Test.com ' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('asha@test.com');
  });

  test('role defaults to student and instructor is allowed', async () => {
    const { role, ...noRole } = valid;
    expect((await request(app).post('/api/auth/register').send(noRole)).body.user.role).toBe('student');
    const res = await request(app).post('/api/auth/register').send({ ...valid, email: 'i@test.com', role: 'instructor' });
    expect(res.body.user.role).toBe('instructor');
  });
});

describe('TC-Auth-02 register with duplicate/invalid email or password policy (CSMQP-F-001)', () => {
  test('duplicate email is rejected (case-insensitive)', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/register').send({ ...valid, email: 'ASHA@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
    expect(await User.countDocuments()).toBe(1);
  });

  test.each(['plainaddress', 'no@tld', 'a b@test.com', '', '@test.com'])('invalid email %p is rejected', async (email) => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, email });
    expect(res.status).toBe(400);
  });

  test.each([
    ['Ab1', 'too short'],
    ['alllowercase1', 'no uppercase'],
    ['ALLUPPERCASE1', 'no lowercase'],
    ['NoDigitsHere', 'no digit'],
  ])('password %p (%s) is rejected', async (password) => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, password });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('password boundary: 8 characters accepted, 7 rejected, 64 accepted, 65 rejected', async () => {
    const post = (password, n) => request(app).post('/api/auth/register').send({ ...valid, email: `b${n}@test.com`, password });
    expect((await post('Abcdef1x', 1)).status).toBe(201);
    expect((await post('Abcde1x', 2)).status).toBe(400);
    expect((await post('Aa1' + 'x'.repeat(61), 3)).status).toBe(201);
    expect((await post('Aa1' + 'x'.repeat(62), 4)).status).toBe(400);
  });

  test('admin role cannot be self-registered', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, role: 'admin' });
    expect(res.status).toBe(400);
  });

  test('missing body and non-string fields are rejected', async () => {
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ ...valid, name: { a: 1 } })).status).toBe(400);
  });
});

describe('TC-Auth-03 login with valid credentials (CSMQP-F-002)', () => {
  test('returns a signed JWT usable on /me', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/login').send({ email: 'ASHA@test.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token.split('.')).toHaveLength(3);
    const me = await request(app).get('/api/auth/me').set(bearer(res.body.token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('asha@test.com');
  });
});

describe('TC-Auth-04 login with invalid credentials (CSMQP-F-002)', () => {
  beforeEach(() => request(app).post('/api/auth/register').send(valid));

  test('wrong password and unknown email give the same 401 message', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: valid.email, password: 'Wrong1234' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect(wrong.body.token).toBeUndefined();
  });

  test('missing fields are rejected with 400', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: valid.email })).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });

  test('blocked accounts cannot log in', async () => {
    await User.updateOne({ email: valid.email }, { status: 'blocked' });
    const res = await request(app).post('/api/auth/login').send({ email: valid.email, password: PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('authenticate middleware integration', () => {
  test('GET /api/auth/me without a token returns 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  test('a token for a blocked user is refused with 403', async () => {
    const { token, user } = await createUser('student');
    await User.updateOne({ _id: user.id }, { status: 'blocked' });
    expect((await request(app).get('/api/auth/me').set(bearer(token))).status).toBe(403);
  });

  test('malformed JSON body returns a 400 JSON error', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(expect.any(String));
  });
});
