const jwt = require('jsonwebtoken');
const { signToken, verifyToken } = require('../src/utils/jwt');
const validatePassword = require('../src/utils/passwordPolicy');

const user = { _id: '64b000000000000000000001', role: 'instructor' };

describe('TC-Auth-03 JWT issue/verify (unit)', () => {
  test('signed token round-trips subject and role and carries an expiry', () => {
    const payload = verifyToken(signToken(user));
    expect(payload.sub).toBe(user._id);
    expect(payload.role).toBe('instructor');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test('token signed with another secret is rejected', () => {
    const forged = jwt.sign({ sub: user._id }, 'other-secret');
    expect(() => verifyToken(forged)).toThrow();
  });

  test('unsigned (alg=none) token is rejected', () => {
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: user._id })).toString('base64url');
    expect(() => verifyToken(`${none}.${body}.`)).toThrow();
  });
});

describe('TC-Auth-02 password policy (unit)', () => {
  test('accepts a compliant password', () => expect(validatePassword('Passw0rd!')).toEqual([]));
  test('rejects non-strings', () => expect(validatePassword(undefined)).toHaveLength(1));
  test('reports every violated rule', () => expect(validatePassword('abc').length).toBe(3));
});
