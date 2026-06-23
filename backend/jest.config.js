module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  testTimeout: 30000,
  // mongodb-memory-server can be slow to download its binary on first run
  forceExit: true,
};
