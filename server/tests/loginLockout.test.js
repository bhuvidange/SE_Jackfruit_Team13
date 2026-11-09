const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, PASSWORD } = require('./helpers');
const authRoutes = require('../src/routes/auth');

beforeAll(connect);
afterAll(disconnect);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearAll();
});

describe('failed-login lockout', () => {
  beforeEach(() => authRoutes.loginLockout.reset());

  test('the sixth failed credential check returns 429 and blocks later attempts for the window', async () => {
    const { email } = await createUser('student', 'lockout@test.com');

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' });
      expect(response.status).toBe(401);
    }

    const sixthLogin = await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' });
    expect(sixthLogin.status).toBe(429);
    expect(sixthLogin.body.message).toMatch(/failed login attempts/i);
    expect(Number(sixthLogin.headers['retry-after'])).toBeGreaterThan(0);

    const next = await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' });
    expect(next.status).toBe(429);
  });

  test('a successful login clears the failed-attempt count', async () => {
    const { email } = await createUser('student', 'reset-lockout@test.com');

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' })).status).toBe(401);
    }

    expect((await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(200);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' })).status).toBe(401);
    }
    expect((await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' })).status).toBe(429);
  });

  test('malformed requests do not count as failed credential checks', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
    }

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect((await request(app).post('/api/auth/login').send({ email: 'unknown@test.com', password: 'Wrong1234' })).status).toBe(401);
    }
    expect((await request(app).post('/api/auth/login').send({ email: 'unknown@test.com', password: 'Wrong1234' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'unknown@test.com', password: 'Wrong1234' })).status).toBe(429);
  });

  test('lockouts are isolated by client IP', async () => {
    const { email } = await createUser('student', 'ip-lockout@test.com');
    const previousTrustProxy = app.get('trust proxy');
    app.set('trust proxy', 1);

    try {
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        const response = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', '198.51.100.10')
          .send({ email, password: 'Wrong1234' });
        expect(response.status).toBe(attempt < 6 ? 401 : 429);
      }

      const otherIp = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.11')
        .send({ email, password: PASSWORD });
      expect(otherIp.status).toBe(200);

      const blockedIpAgain = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.10')
        .send({ email, password: PASSWORD });
      expect(blockedIpAgain.status).toBe(429);
    } finally {
      app.set('trust proxy', previousTrustProxy);
    }
  });

  test('a blocked account does not consume the failed-credential budget', async () => {
    const { email } = await createUser('student', 'blocked-lockout@test.com');
    const User = require('../src/models/User');
    await User.updateOne({ email }, { status: 'blocked' });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(403);
    }
    expect((await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(403);
  });

  test('the failed-attempt counter expires after its configured window', async () => {
    const { email } = await createUser('student', 'expiry-lockout@test.com');
    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' })).status).toBe(401);
    }
    expect((await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' })).status).toBe(429);

    jest.spyOn(Date, 'now').mockReturnValue(start + 15 * 60 * 1000 + 1);
    expect((await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(200);
  });
});
