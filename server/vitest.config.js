import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js'],
    exclude: ['tests/**', 'node_modules/**'],
    coverage: {
      reporter: ['text', 'text-summary'],
    },
  },
});
