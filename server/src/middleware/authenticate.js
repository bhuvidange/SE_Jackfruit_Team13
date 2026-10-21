const HttpError = require('../utils/httpError');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/** Validates the Bearer JWT (CSMQP-SR-002) and attaches the active user to req.user. */
module.exports = async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw new HttpError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Invalid token');
  if (user.status !== 'active') throw new HttpError(403, 'Account is blocked');

  req.user = user;
  next();
};
