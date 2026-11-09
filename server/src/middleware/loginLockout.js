const HttpError = require('../utils/httpError');

/**
 * Track failed credential checks by client IP. The configured threshold failure receives 429;
 * further login attempts are blocked until that window expires.
 */
module.exports = function loginLockout({ windowMs, maxFailures }) {
  const attempts = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(ip);
    }
  }, windowMs);
  sweep.unref();

  function entryFor(ip) {
    const now = Date.now();
    let entry = attempts.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { failures: 0, resetAt: now + windowMs };
      attempts.set(ip, entry);
    }
    return { entry, now };
  }

  function retryAfter(entry, now) {
    return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  }

  function middleware(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    let entry = attempts.get(ip);
    if (entry && entry.resetAt <= now) attempts.delete(ip);
    if (entry && entry.resetAt <= now) entry = undefined;
    if (entry && entry.resetAt > now && entry.failures >= maxFailures) {
      res.set('Retry-After', String(retryAfter(entry, now)));
      throw new HttpError(429, 'Too many failed login attempts, please try again later');
    }
    next();
  }

  middleware.recordFailure = (req) => {
    const { entry, now } = entryFor(req.ip);
    entry.failures += 1;
    if (entry.failures >= maxFailures) {
      return { blocked: true, retryAfter: retryAfter(entry, now) };
    }
    return { blocked: false };
  };

  middleware.clear = (req) => attempts.delete(req.ip);
  middleware.reset = () => attempts.clear();

  return middleware;
};
