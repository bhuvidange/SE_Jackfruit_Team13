const path = require('path');
require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (env === 'production' ? null : 'dev-only-secret-change-me');
if (!jwtSecret) throw new Error('JWT_SECRET must be set in production');

module.exports = {
  env,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/csmqp',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  maxUploadBytes: 15 * 1024 * 1024, // CSMQP-F-011
  submitGraceSeconds: Number(process.env.SUBMIT_GRACE_SECONDS ?? 5),
  authRateLimit: {
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
