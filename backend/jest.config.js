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
  // socketService is now covered by socket.int.test.js (socket.io-client). Only
  // relayService (ffmpeg→RTMP data path) + index.js (bootstrap) stay excluded —
  // they're exercised by the live system + functional E2E, not unit tests.
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/services/relayService.js'],
  // CI gate (jest --coverage): ≥95% lines enforced — build fails on regression.
  coverageThreshold: {
    global: { lines: 95, statements: 88, functions: 90, branches: 60 },
  },
};
