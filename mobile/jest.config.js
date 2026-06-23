module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/utils/__tests__/**/*.test.ts'],
  // Use the project's babel.config.js (babel-preset-expo) which strips TS.
  transform: { '^.+\\.(t|j)sx?$': 'babel-jest' },
  transformIgnorePatterns: ['/node_modules/'],
};
