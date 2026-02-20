module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testMatch: ['**/tests/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '/feathers/', '/docs/', '/dist/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/feathers/', '/docs/', '/dist/'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
