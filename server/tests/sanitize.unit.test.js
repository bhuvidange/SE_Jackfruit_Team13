const sanitize = require('../src/middleware/sanitize');
const authorize = require('../src/middleware/authorize');

describe('TC-Sec-04 sanitizer (unit)', () => {
  const { clean, cleanString } = sanitize;

  test('strips tags but keeps surrounding text', () => {
    expect(cleanString('Hello <b>world</b>')).toBe('Hello world');
    expect(cleanString('<script>alert(1)</script>x')).toBe('alert(1)x');
  });

  test('escapes a dangling open tag', () => {
    expect(cleanString('<img src=x onerror=alert(1)')).toBe('&lt;img src=x onerror=alert(1)');
  });

  test('leaves comparison operators alone', () => {
    expect(cleanString('1 < 2 > 0')).toBe('1 < 2 > 0');
  });

  test('removes operator and dotted keys recursively and keeps clean data', () => {
    const out = clean({ a: { $gt: 1, b: 'ok' }, list: [{ $where: 'x', n: 1 }], 'x.y': 2, __proto__: { p: 1 } });
    expect(out).toEqual({ a: { b: 'ok' }, list: [{ n: 1 }] });
  });

  test('does not touch password fields', () => {
    expect(clean({ password: '<b>Aa1' }).password).toBe('<b>Aa1');
  });

  test('passes through non-string primitives', () => {
    expect(clean({ n: 3, t: true, z: null })).toEqual({ n: 3, t: true, z: null });
  });
});

describe('TC-Auth-05 authorize middleware (unit)', () => {
  const run = (user, roles) => {
    const next = jest.fn();
    let error;
    try {
      authorize(...roles)({ user }, {}, next);
    } catch (e) {
      error = e;
    }
    return { next, error };
  };

  test('allows a listed role', () => {
    const { next, error } = run({ role: 'instructor' }, ['instructor', 'admin']);
    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test('rejects an unlisted role with 403', () => {
    const { next, error } = run({ role: 'student' }, ['instructor']);
    expect(error.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a missing user with 401', () => {
    expect(run(undefined, ['student']).error.status).toBe(401);
  });
});
