const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const validatePassword = require('../utils/passwordPolicy');
const { signToken } = require('../utils/jwt');
const authenticate = require('../middleware/authenticate');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

// CSMQP-F-001
router.post('/register', async (req, res) => {
  const { name, email, password, role = 'student' } = req.body || {};
  const errors = [];
  if (typeof name !== 'string' || !name.trim()) errors.push('Name is required');
  else if (name.trim().length > 100) errors.push('Name must be at most 100 characters');
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    errors.push('A valid email address is required');
  }
  errors.push(...validatePassword(password));
  // Administrators are provisioned by seeding / admin tools, never by self-registration.
  if (role !== 'student' && role !== 'instructor') errors.push('Role must be student or instructor');
  if (errors.length) throw new HttpError(400, errors.join('. '), { errors });

  const normalized = email.trim().toLowerCase();
  const duplicate = () => new HttpError(400, 'Email is already registered', { errors: ['Email is already registered'] });
  if (await User.exists({ email: normalized })) throw duplicate();

  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: normalized,
      role,
      passwordHash: await bcrypt.hash(password, config.bcryptRounds),
    });
  } catch (err) {
    if (err.code === 11000) throw duplicate();
    throw err;
  }
  res.status(201).json({ user, token: signToken(user) });
});

// CSMQP-F-002
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  // Only plain strings are accepted, so operator objects such as {"$gt": ""} never reach the query.
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'Email and password are required');
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !matches) throw new HttpError(401, 'Invalid email or password');
  if (user.status !== 'active') throw new HttpError(403, 'Account is blocked');
  res.json({ user, token: signToken(user) });
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

module.exports = router;
