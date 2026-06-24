module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  testTimeout: 30000,
  // mongodb-memory-server can be slow to download its binary on first run
  forceExit: true,
  // Coverage is measured on the business logic. relayService (ffmpeg→RTMP) and
  // socketService (socket.io realtime) are exercised by the live system + the
  // functional E2E suites, not unit tests; index.js is the server bootstrap —
  // all excluded from the unit-coverage denominator (testing them as units has
  // no signal). 100% line coverage of the whole app is NOT the target.
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/services/relayService.js', '!src/services/socketService.js'],
  // CI gate (jest --coverage): a floor that catches regressions.
  coverageThreshold: {
    global: { lines: 55, statements: 55, functions: 45, branches: 30 },
  },
};
