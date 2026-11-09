const request = require('supertest');
const { app, connect, disconnect, clearAll, createUser, bearer, PASSWORD } = require('./helpers');

const login = (email) => request(app).post('/api/auth/login').send({ email, password: PASSWORD });
const MISSING_ID = '507f1f77bcf86cd799439011';

beforeAll(connect);
afterAll(disconnect);
beforeEach(clearAll);

describe('TC-Admin-01 access control (CSMQP-F-050)', () => {
  test('TC-Admin-01 students and instructors get 403 on every admin route', async () => {
    const target = await createUser('student');
    const id = target.user.id;
    for (const role of ['student', 'instructor']) {
      const { token } = await createUser(role);
      const h = bearer(token);
      expect((await request(app).get('/api/admin/users').set(h)).status).toBe(403);
      expect((await request(app).patch(`/api/admin/users/${id}/block`).set(h)).status).toBe(403);
      expect((await request(app).patch(`/api/admin/users/${id}/unblock`).set(h)).status).toBe(403);
      expect((await request(app).delete(`/api/admin/users/${id}`).set(h)).status).toBe(403);
    }
  });

  test('TC-Admin-01 requests without a token get 401', async () => {
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
    expect((await request(app).patch(`/api/admin/users/${MISSING_ID}/block`)).status).toBe(401);
    expect((await request(app).patch(`/api/admin/users/${MISSING_ID}/unblock`)).status).toBe(401);
    expect((await request(app).delete(`/api/admin/users/${MISSING_ID}`)).status).toBe(401);
  });
});

describe('TC-Admin-02 list, search and filter', () => {
  test('TC-Admin-02 lists users newest first without password hashes', async () => {
    const admin = await createUser('admin');
    await createUser('student');
    await createUser('instructor');
    const res = await request(app).get('/api/admin/users').set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(3);
    expect(res.body.users[0].role).toBe('instructor');
    for (const u of res.body.users) expect(u).not.toHaveProperty('passwordHash');
  });

  test('TC-Admin-02 q searches name or email case-insensitively and escapes regex characters', async () => {
    const admin = await createUser('admin');
    await createUser('student', 'alice.smith@test.com');
    await createUser('instructor', 'bob@example.org');
    const get = (query) => request(app).get('/api/admin/users').query(query).set(bearer(admin.token));
    expect((await get({ q: 'ALICE.SMITH' })).body.users.map((u) => u.email)).toEqual(['alice.smith@test.com']);
    expect((await get({ q: 'EXAMPLE' })).body.users.map((u) => u.email)).toEqual(['bob@example.org']);
    expect((await get({ q: 'test INSTRUCTOR' })).body.users.map((u) => u.email)).toEqual(['bob@example.org']);
    expect((await get({ q: '.*' })).body.users).toHaveLength(0);
  });

  test('TC-Admin-02 role filter and invalid filter values', async () => {
    const admin = await createUser('admin');
    await createUser('student');
    await createUser('instructor');
    const get = (query) => request(app).get('/api/admin/users').query(query).set(bearer(admin.token));
    expect((await get({ role: 'instructor' })).body.users.map((u) => u.role)).toEqual(['instructor']);
    expect((await get({ role: 'boss' })).status).toBe(400);
    expect((await request(app).get('/api/admin/users?q=a&q=b').set(bearer(admin.token))).status).toBe(400);
  });
});

describe('TC-Admin-03 block and unblock', () => {
  test('TC-Admin-03 blocking locks out the existing token and login; unblocking restores login', async () => {
    const admin = await createUser('admin');
    const student = await createUser('student');
    const blocked = await request(app).patch(`/api/admin/users/${student.user.id}/block`).set(bearer(admin.token));
    expect(blocked.status).toBe(200);
    expect(blocked.body.user.status).toBe('blocked');
    expect(blocked.body.user).not.toHaveProperty('passwordHash');

    expect((await request(app).get('/api/auth/me').set(bearer(student.token))).status).toBe(403);
    expect((await login(student.email)).status).toBe(403);

    const unblocked = await request(app).patch(`/api/admin/users/${student.user.id}/unblock`).set(bearer(admin.token));
    expect(unblocked.status).toBe(200);
    expect(unblocked.body.user.status).toBe('active');
    expect((await login(student.email)).status).toBe(200);
  });
});

describe('TC-Admin-04 delete', () => {
  test('TC-Admin-04 deleting removes the user: token gives 401 and login fails', async () => {
    const admin = await createUser('admin');
    const student = await createUser('student');
    const res = await request(app).delete(`/api/admin/users/${student.user.id}`).set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(bearer(student.token))).status).toBe(401);
    expect((await login(student.email)).status).toBe(401);
    const list = await request(app).get('/api/admin/users').set(bearer(admin.token));
    expect(list.body.users.map((u) => u.id)).not.toContain(student.user.id);
  });
});

describe('TC-Admin-05 protections', () => {
  test('TC-Admin-05 an admin cannot block or delete themselves', async () => {
    const admin = await createUser('admin');
    const h = bearer(admin.token);
    const block = await request(app).patch(`/api/admin/users/${admin.user.id}/block`).set(h);
    const del = await request(app).delete(`/api/admin/users/${admin.user.id}`).set(h);
    expect(block.status).toBe(400);
    expect(del.status).toBe(400);
    expect(block.body).toHaveProperty('message');
    expect((await request(app).get('/api/auth/me').set(h)).status).toBe(200);
  });

  test('TC-Admin-05 an admin cannot block or delete another admin', async () => {
    const admin = await createUser('admin');
    const other = await createUser('admin');
    const h = bearer(admin.token);
    expect((await request(app).patch(`/api/admin/users/${other.user.id}/block`).set(h)).status).toBe(403);
    expect((await request(app).delete(`/api/admin/users/${other.user.id}`).set(h)).status).toBe(403);
    expect((await login(other.email)).status).toBe(200);
  });

  test('TC-Admin-05 unknown id gives 404 and malformed id gives 400', async () => {
    const admin = await createUser('admin');
    const h = bearer(admin.token);
    expect((await request(app).patch(`/api/admin/users/${MISSING_ID}/block`).set(h)).status).toBe(404);
    expect((await request(app).patch(`/api/admin/users/${MISSING_ID}/unblock`).set(h)).status).toBe(404);
    expect((await request(app).delete(`/api/admin/users/${MISSING_ID}`).set(h)).status).toBe(404);
    expect((await request(app).patch('/api/admin/users/not-an-id/block').set(h)).status).toBe(400);
    expect((await request(app).delete('/api/admin/users/not-an-id').set(h)).status).toBe(400);
  });
});
