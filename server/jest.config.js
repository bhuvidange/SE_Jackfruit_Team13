module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/setup/globalSetup.js',
  globalTeardown: './tests/setup/globalTeardown.js',
  setupFiles: ['./tests/setup/env.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 60000,
  // Entry points (server.js, seed.js) and the DB connector are exercised manually, not by the suites.
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/seed.js', '!src/db.js'],
  coverageReporters: ['text-summary', 'lcov'],
  // Floors a few points below current coverage; raise them as coverage improves.
  coverageThreshold: { global: { statements: 90, branches: 85, functions: 95, lines: 95 } },
};
