const express = require('express');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
const ROLES = ['student', 'instructor', 'admin'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.use(authenticate, authorize('admin'));

// CSMQP-F-050: list / search users
router.get('/users', async (req, res) => {
  const { q, role } = req.query;
  for (const [key, value] of Object.entries({ q, role })) {
    if (value !== undefined && typeof value !== 'string') throw new HttpError(400, `Invalid ${key}`);
  }
  const filter = {};
  if (role) {
    if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
    filter.role = role;
  }
  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json({ users });
});

/** Finds the target of a block / unblock / delete and enforces the self and admin protections. */
async function findManageable(req) {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (user._id.equals(req.user._id)) throw new HttpError(400, 'You cannot block or delete your own account');
  if (user.role === 'admin') throw new HttpError(403, 'You cannot block or delete another administrator');
  return user;
}

router.patch('/users/:id/block', async (req, res) => {
  const user = await findManageable(req);
  user.status = 'blocked';
  await user.save();
  res.json({ user });
});

router.patch('/users/:id/unblock', async (req, res) => {
  const user = await findManageable(req);
  user.status = 'active';
  await user.save();
  res.json({ user });
});

// Their materials, questions and attempts are intentionally left in place.
router.delete('/users/:id', async (req, res) => {
  const user = await findManageable(req);
  await user.deleteOne();
  res.json({ message: 'User deleted' });
});

module.exports = router;
