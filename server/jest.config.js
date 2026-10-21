module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/setup/globalSetup.js',
  globalTeardown: './tests/setup/globalTeardown.js',
  setupFiles: ['./tests/setup/env.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 60000,
};
