module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  roots: ['<rootDir>/tests'], // this tells Jest where your tests are
  testMatch: ['**/?(*.)+(spec|test).ts'], // matches *.test.ts or *.spec.ts
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/docs/', '/dist/'],
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
