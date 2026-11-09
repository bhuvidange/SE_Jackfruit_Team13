const cors = require('cors');

/** Configure browser CORS for the exact, comma-separated frontend origin allow-list. */
module.exports = function corsAllowList({ origin: allowedOrigins }) {
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    throw new TypeError('At least one frontend origin must be configured');
  }

  for (const origin of allowedOrigins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new TypeError('CORS origins must be exact HTTP(S) origins; wildcard CORS is not allowed');
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password
    ) {
      throw new TypeError('CORS origins must be exact HTTP(S) origins; wildcard CORS is not allowed');
    }
  }

  const origins = new Set(allowedOrigins);
  const corsMiddleware = cors({
    origin(requestOrigin, callback) {
      callback(null, origins.has(requestOrigin) ? requestOrigin : false);
    },
  });

  return function allowListedCors(req, res, next) {
    const origin = req.headers.origin;
    // Requests without an Origin header are not browser cross-origin requests and need no CORS grant.
    if (!origin) return next();
    res.vary('Origin');
    if (!origins.has(origin)) return next();
    return corsMiddleware(req, res, next);
  };
};
