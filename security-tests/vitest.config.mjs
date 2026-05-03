/**
 * Vitest config for the API security harness.
 *
 * Why a `.mjs` plain-object export rather than `vitest/config`:
 *   The repo root does not depend on vitest (it lives in
 *   `server/node_modules`). Vitest's TS-config loader compiles
 *   the config file in a temp dir under repo-root node_modules
 *   and tries to resolve `vitest/config` from there — which
 *   fails because vitest isn't installed at the repo root.
 *
 *   Exporting a plain object skips the import resolution step
 *   entirely. Vitest accepts the object as-is and runs the
 *   harness with the server-side vitest install (the harness
 *   wrapper sets cwd=server so vitest resolves there).
 *
 * Why a dedicated config rather than the server's vitest.config.js:
 *   The server config registers __tests__ glob + module mocks
 *   that don't apply here. The security harness exercises the
 *   running server over HTTP and must NOT mock fetch / prisma /
 *   auth.
 */
export default {
  test: {
    include: ['security-tests/api-security.test.ts'],
    // Single fork — many tests fire bursts at the rate limiter,
    // and parallel runs would pollute each other's counters.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    // Hard cap per test — the rate-limit + oversized-upload tests
    // intentionally take time but must never hang indefinitely.
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ['verbose'],
  },
};
