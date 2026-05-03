#!/usr/bin/env node
/**
 * run-api-security-harness.mjs — wrapper that runs the live-HTTP
 * API security harness via the server's vitest install.
 *
 *   npm run security:test
 *
 * Why this wrapper exists
 * ───────────────────────
 *   The repo-root package.json does not depend on vitest (the
 *   frontend uses vite for builds, not vitest for tests). Vitest
 *   ships only in `server/node_modules` because the server's
 *   unit suite needs it.
 *
 *   Rather than install vitest twice, this wrapper spawns the
 *   server-side vitest binary with the harness's repo-root
 *   config so a single source-of-truth vitest version powers
 *   both suites.
 *
 * Strict-rule audit
 *   • Read-only outside spawning a child process.
 *   • Inherits the parent env so API_BASE_URL / *_TOKEN /
 *     *_ID env vars reach the harness untouched.
 *   • Exits with the child's exit code so CI fails correctly.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..', '..');
const SERVER_DIR = path.join(REPO_ROOT, 'server');
const CONFIG     = path.join(REPO_ROOT, 'security-tests', 'vitest.config.mjs');

const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(
  npxBin,
  ['vitest', 'run', '--config', CONFIG, '--root', REPO_ROOT],
  {
    cwd:   SERVER_DIR,
    env:   process.env,
    stdio: 'inherit',
    // Windows requires shell:true to resolve `.cmd` shims.
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
  console.error('[security:test] failed to spawn vitest:', err.message);
  process.exit(1);
});
