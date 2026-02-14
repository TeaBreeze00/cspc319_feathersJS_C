module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testMatch: ['**/tests/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  coverageThreshold: {
    global: {
      lines: 80
    }
  }
};
