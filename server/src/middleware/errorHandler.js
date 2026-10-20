const config = require('../config');

// Consistent JSON errors; internals are never leaked (SAD 4.5).
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: errors.join('. '), errors });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier or value' });
  if (err.code === 11000) return res.status(409).json({ message: 'Duplicate value' });

  const status = err.status || err.statusCode;
  if (status && status < 500) {
    return res.status(status).json({ message: err.message, ...(err.extra || {}) });
  }

  if (config.env !== 'test') console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
};
