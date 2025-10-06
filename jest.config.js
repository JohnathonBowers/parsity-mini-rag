module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/app'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '/app/libs/openai/agents/__tests__/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/app/libs/openai/agents/__tests__/setup.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'app/**/*.ts',
    '!app/**/*.test.ts',
    '!app/**/__tests__/**',
  ],
};
