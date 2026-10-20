const jwt = require('jsonwebtoken');
const config = require('../config');

const ALGORITHM = 'HS256';

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: config.jwtExpiresIn,
  });
}

/** Throws jsonwebtoken errors (TokenExpiredError / JsonWebTokenError) on bad tokens. */
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
