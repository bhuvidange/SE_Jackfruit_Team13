const path = require('path');
require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (env === 'production' ? null : 'dev-only-secret-change-me');
if (!jwtSecret) throw new Error('JWT_SECRET must be set in production');
const mongoUri = process.env.MONGODB_URI || (env === 'production' ? null : 'mongodb://127.0.0.1:27017/csmqp');
if (!mongoUri) throw new Error('MONGODB_URI must be set in production');
const corsOriginValue = process.env.CORS_ORIGIN ?? (env === 'production' ? '' : 'http://localhost:5173');
const corsOrigins = corsOriginValue.split(',').map((origin) => origin.trim()).filter(Boolean);
if (env === 'production') {
  if (corsOrigins.length === 0) throw new Error('CORS_ORIGIN must include at least one frontend origin in production');
  for (const origin of corsOrigins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('CORS_ORIGIN must contain exact HTTP(S) origins in production');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) {
      throw new Error('CORS_ORIGIN must contain exact HTTP(S) origins in production');
    }
  }
}

module.exports = {
  env,
  port: Number(process.env.PORT) || 5000,
  mongoUri,
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
  loginLockout: {
    windowMs: Number(process.env.LOGIN_LOCKOUT_WINDOW_MS) || 15 * 60 * 1000,
    maxFailures: Number(process.env.LOGIN_LOCKOUT_MAX_FAILURES) || 6,
  },
  corsOrigins,
};
