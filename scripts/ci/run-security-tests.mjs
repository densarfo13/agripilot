#!/usr/bin/env node
/**
 * run-security-tests.mjs — wrapper that runs the security test
 * suite from `npm run security:test` with the env-vars the
 * server-side `lib/env.js` requires at import time.
 *
 * Why this wrapper exists
 * ───────────────────────
 *   `lib/env.js` is imported transitively by some auth tests
 *   (e.g. `security.mfa.test.js`). It calls `required('AUTH_SECRET')`
 *   and `required('DATABASE_URL')` at module load. In a real
 *   server boot those env-vars are always set; in a fresh CI
 *   shell they are not, so the tests crash before the first
 *   `describe()` runs.
 *
 *   This wrapper supplies safe placeholder values so the import
 *   side-effects pass, then spawns vitest in `server/` against
 *   the curated security suite.
 *
 * Strict-rule audit
 *   • Read-only outside of spawning a child process.
 *   • Placeholder env values are obviously fake (the string
 *     'security-suite-' + a known suffix) so no test code can
 *     mistake them for real production secrets.
 *   • Exits with the child process's exit code so CI fails
 *     correctly on test failure.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..', '..');
const SERVER_DIR = path.join(REPO_ROOT, 'server');

// The curated security test suites. Adding a new one is a
// one-line edit here; see SECURITY_AUDIT_REPORT.md §16.
const TEST_FILES = [
  'src/__tests__/permissions.test.js',
  'src/__tests__/auth.test.js',
  'src/__tests__/orgScope.test.js',
  'src/__tests__/sodGuard.test.js',
  'src/__tests__/security-service.test.js',
  'src/__tests__/security.mfa.test.js',
  'src/__tests__/roleAliases.test.js',
  // Merged-blocker fixes (this turn):
  'src/__tests__/errorHandlerLeak.test.js',  // §5 — error scrubbing
  'src/__tests__/uploadValidator.test.js',   // §7 — upload MIME/size
  'src/__tests__/requireOwnership.test.js',  // §1 — IDOR / ownership
  'src/__tests__/adminRouteAlias.test.js',   // §4 — /api/admin mount
  'src/__tests__/protectedRouter.test.js',   // defence-in-depth: registration-time block
  'src/__tests__/softLaunchEvents.test.js',  // POST /api/events + /api/errors + admin/metrics
  'src/__tests__/aiTaskEngine.test.js',      // AI Task Engine v1 — POST /api/tasks/today
];

// Placeholder env values for the security-test boot path.
// `lib/env.js` only checks "is this string non-empty"; it
// doesn't validate shape, so any obviously-fake string is fine.
const TEST_ENV = {
  ...process.env,
  NODE_ENV:        'test',
  DATABASE_URL:    process.env.DATABASE_URL    || 'postgresql://security-suite-placeholder@localhost:5432/security-suite',
  AUTH_SECRET:     process.env.AUTH_SECRET     || 'security-suite-placeholder-auth-secret-32-chars-min',
  JWT_SECRET:      process.env.JWT_SECRET      || 'security-suite-placeholder-jwt-secret-32-chars-min',
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'security-suite-placeholder-access-token-secret',
  REDIS_URL:       process.env.REDIS_URL       || '',
};

const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(
  npxBin,
  ['vitest', 'run', '--reporter=dot', ...TEST_FILES],
  {
    cwd:   SERVER_DIR,
    env:   TEST_ENV,
    stdio: 'inherit',
    // Windows requires shell:true to resolve `.cmd` shims via PATH.
    // POSIX is happy either way; using shell:true uniformly keeps the
    // behaviour predictable across platforms.
    shell: true,
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[security:test] killed by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error(`[security:test] failed to spawn vitest:`, err.message);
  process.exit(1);
});
