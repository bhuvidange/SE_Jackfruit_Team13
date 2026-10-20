/**
 * Finalized password policy (SRS 4.1 left it TBD): 8-64 characters with at least
 * one lowercase letter, one uppercase letter and one digit. The upper bound keeps
 * us under bcrypt's 72-byte input limit.
 */
module.exports = function validatePassword(password) {
  if (typeof password !== 'string') return ['Password is required'];
  const problems = [];
  if (password.length < 8) problems.push('Password must be at least 8 characters');
  if (password.length > 64) problems.push('Password must be at most 64 characters');
  if (!/[a-z]/.test(password)) problems.push('Password must contain a lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('Password must contain an uppercase letter');
  if (!/[0-9]/.test(password)) problems.push('Password must contain a digit');
  return problems;
};
