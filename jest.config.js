// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/docs/',
    '/dist/',
    'tests/tools/templates/',
    'tests/tools/codegen/',
    'tests/tools/validation/',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/docs/',
    '/dist/',
    'src/tools/codegen/',
    'src/tools/validation/',
    'src/tools/explainConcept\\.ts',
    'src/tools/generateService\\.ts',
    'src/tools/listTools\\.ts',
    'src/tools/validateCode\\.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
