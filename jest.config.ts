import type { Config } from 'jest';

const config: Config = {
  preset:              'ts-jest',
  testEnvironment:     'node',
  testMatch:           ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    // Resolve @/ path alias (matches tsconfig paths)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Show test names in output
  verbose: true,
};

export default config;
