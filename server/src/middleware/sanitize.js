// Input sanitizer (CSMQP-SR-004).
//  - NoSQL injection: object keys that start with "$", contain "." or are prototype keys are dropped,
//    so operators like {"$gt": ""} can never reach a Mongoose query.
//  - XSS: HTML tags and "javascript:" URLs are stripped from every string.
// Password fields are left untouched so users can choose any characters; they are only ever hashed.
// CSRF is not applicable: the JWT travels in the Authorization header, not in a cookie.

const TAG_RE = /<\/?[a-zA-Z!][^>]*>/g;
const OPEN_TAG_RE = /<(?=[a-zA-Z/!])/g;
const JS_URL_RE = /javascript\s*:/gi;
const BAD_KEY_RE = /^\$|\.|\[\$/;
const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const RAW_KEYS = new Set(['password', 'currentPassword', 'newPassword']);

function cleanString(value) {
  return value.replace(TAG_RE, '').replace(OPEN_TAG_RE, '&lt;').replace(JS_URL_RE, '');
}

function clean(value, key) {
  if (typeof value === 'string') return RAW_KEYS.has(key) ? value : cleanString(value);
  if (Array.isArray(value)) return value.map((v) => clean(v, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      if (BAD_KEY_RE.test(k) || PROTO_KEYS.has(k)) continue;
      out[k] = clean(value[k], k);
    }
    return out;
  }
  return value;
}

function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  // Express 5 re-parses req.query on every access, so pin a cleaned copy onto the request.
  Object.defineProperty(req, 'query', { value: clean(req.query), writable: true, configurable: true, enumerable: true });
  next();
}

sanitize.clean = clean;
sanitize.cleanString = cleanString;

module.exports = sanitize;
