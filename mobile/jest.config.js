module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/utils/__tests__/**/*.test.ts'],
  // Use the project's babel.config.js (babel-preset-expo) which strips TS.
  transform: { '^.+\\.(t|j)sx?$': 'babel-jest' },
  transformIgnorePatterns: ['/node_modules/'],
  // Coverage measured on the unit-testable utils. Excluded: googleAuth* (native
  // Google SDK), liveCompositor (canvas/DOM), socket (socket.io + native),
  // useBoardKeyboard (React hook) — these need the RN renderer or a browser and
  // are covered by the E2E suites. The UI (app/, components/) is likewise E2E.
  collectCoverageFrom: [
    'utils/**/*.ts',
    '!utils/googleAuth.ts',
    '!utils/googleAuth.web.ts',
    '!utils/liveCompositor.ts',
    '!utils/socket.ts',
    '!utils/useBoardKeyboard.ts',
  ],
  // CI gate: ≥90% lines on the testable utils (currently ~98%).
  coverageThreshold: {
    global: { lines: 90, statements: 90, functions: 82, branches: 78 },
  },
};
