#!/usr/bin/env node
/**
 * check-server-boot.mjs — module-resolution smoke test for the
 * Express server.
 *
 *   npm run guard:server-boot
 *
 * Why this guard exists
 * ─────────────────────
 *   Static checks (security:routes, security:audit, vite build)
 *   exercise modules INDIVIDUALLY. They never resolve the full
 *   import graph the way Node's runtime does at server start.
 *
 *   A broken relative import like `'../../src/middleware/foo.js'`
 *   from a `server/routes/<x>.js` file (resolves to repo-root,
 *   not to `server/src/`) passes every static check — and then
 *   crashes the deploy with `ERR_MODULE_NOT_FOUND` on first
 *   request.
 *
 *   This guard does what Railway's Node runtime does:
 *     1. Sets the placeholder env vars `lib/env.js` requires at
 *        import time (DATABASE_URL, AUTH_SECRET, JWT_SECRET).
 *     2. Dynamically imports `server/src/app.js`.
 *     3. Reports IMPORT OK on success or the unresolved module
 *        path on failure.
 *
 *   The guard does NOT start the HTTP listener and does NOT
 *   touch the database — by the time Prisma tries the first
 *   query, every module has been resolved. We catch and
 *   ignore Prisma errors AFTER import succeeds.
 *
 * Strict-rule audit
 *   • Read-only — never edits a file, never starts a listener.
 *   • Pure ESM, zero deps beyond `node:child_process`.
 *   • Exit code 0 on import success, 1 on any unresolved
 *     module path.
 *   • Times out at 30s so a hung import doesn't block CI.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..', '..');
const SERVER_DIR = path.join(REPO_ROOT, 'server');

// Placeholder env values — `lib/env.js` only checks
// "is this string non-empty"; it doesn't validate shape.
const TEST_ENV = {
  ...process.env,
  NODE_ENV:        'test',
  DATABASE_URL:    'postgresql://server-boot-guard@localhost:5432/server-boot-guard',
  AUTH_SECRET:     'server-boot-guard-placeholder-32-chars-min', // secrets-scanner:ignore
  JWT_SECRET:      'server-boot-guard-placeholder-32-chars-min', // secrets-scanner:ignore
  ACCESS_TOKEN_SECRET: 'server-boot-guard-placeholder-access-token', // secrets-scanner:ignore
  REDIS_URL:       '',
};

const child = spawn(
  process.execPath, // node binary
  [
    '--input-type=module',
    '-e',
    [
      "import('./src/app.js')",
      "  .then(() => { console.log('IMPORT OK'); process.exit(0); })",
      "  .catch((err) => {",
      "    if (err && err.code === 'ERR_MODULE_NOT_FOUND') {",
      "      console.error('IMPORT FAIL — unresolved module');",
      "      console.error('  url: ', (err.url || ''));",
      "      console.error('  msg: ', err.message || '');",
      "      process.exit(1);",
      "    }",
      "    console.error('IMPORT FAIL —', (err && err.code) || '', err && err.message);",
      "    process.exit(1);",
      "  });",
    ].join(' '),
  ],
  {
    cwd:   SERVER_DIR,
    env:   TEST_ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => { stdout += String(d); });
child.stderr.on('data', (d) => { stderr += String(d); });

const t = setTimeout(() => {
  console.error('IMPORT FAIL — boot guard timed out after 30s');
  try { child.kill('SIGKILL'); } catch { /* swallow */ }
  process.exit(1);
}, 30_000);

child.on('exit', (code, signal) => {
  clearTimeout(t);
  // Report whichever output channel surfaced the verdict.
  const out = (stdout + stderr).trim();
  if (code === 0) {
    console.log('\u2713 server-boot: every module resolves');
    process.exit(0);
  }
  console.error('\u2717 server-boot: unresolved module(s) detected');
  if (out) console.error(out);
  if (signal) console.error(`(killed by signal ${signal})`);
  process.exit(1);
});

child.on('error', (err) => {
  clearTimeout(t);
  console.error('\u2717 server-boot: failed to spawn node child:', err.message);
  process.exit(1);
});
