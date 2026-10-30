const HttpError = require('../utils/httpError');

/**
 * Fixed-window, in-memory rate limiter keyed by client IP. Used on the auth routes to slow down
 * password guessing. State is per process, which is enough for the single-instance deployment.
 */
module.exports = function rateLimit({ windowMs, max, message = 'Too many requests, please try again later' }) {
  const hits = new Map();

  // Drop finished windows so the map does not grow without bound; unref() so it never keeps the process alive.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  sweep.unref();

  function limiter(req, res, next) {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new HttpError(429, message);
    }
    next();
  }

  limiter.reset = () => hits.clear();
  return limiter;
};
