import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js'],
    exclude: ['tests/**', 'node_modules/**'],
    // Test-only i18n column preload. The repo-root `vitest.setup.js`
    // eagerly merges every locale column into the shared T object so
    // synchronous `t(key, lang)` calls in tests resolve correctly.
    // Production lazy-loads via `src/i18n/columnLoader.js` — this
    // file is NOT read in production.
    setupFiles: ['../vitest.setup.js'],
    coverage: {
      reporter: ['text', 'text-summary'],
    },
  },
});
