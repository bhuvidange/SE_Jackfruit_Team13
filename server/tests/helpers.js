const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

let counter = 0;

async function connect() {
  // runtimeAdapters: the driver otherwise loads `os` via dynamic import(), which Jest's sandbox
  // does not support, leaving the connection handshake without client metadata.
  await mongoose.connect(process.env.MONGO_URL_TEST, {
    runtimeAdapters: { os: require('os') },
    dbName: `t_${process.pid}_${Date.now()}_${counter++}`,
  });
}

async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

async function clearAll() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

const PASSWORD = 'Passw0rd!';

/** Registers a user through the API (or inserts an admin directly) and returns { user, token }. */
async function createUser(role = 'student', email) {
  const addr = email || `${role}${++counter}@test.com`;
  if (role === 'admin') {
    const bcrypt = require('bcryptjs');
    await User.create({
      name: 'Admin',
      email: addr,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: 'admin',
    });
  } else {
    await request(app).post('/api/auth/register').send({ name: `Test ${role}`, email: addr, password: PASSWORD, role });
  }
  const res = await request(app).post('/api/auth/login').send({ email: addr, password: PASSWORD });
  return { user: res.body.user, token: res.body.token, email: addr };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, connect, disconnect, clearAll, createUser, bearer, PASSWORD };
