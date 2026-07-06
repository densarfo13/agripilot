#!/usr/bin/env node
/**
 * install-hooks.mjs — activate the version-controlled .githooks/ directory.
 *
 * Run once per clone:   node scripts/git/install-hooks.mjs
 * (or wire into an npm "prepare" script so it runs on `npm install`).
 *
 * Sets core.hooksPath so every developer/machine shares the SAME hooks from
 * git, and marks them executable (recorded in git for other OSes/CI).
 */
import { execSync } from 'node:child_process';
import { chmodSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOKS_DIR = '.githooks';
const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();

if (!existsSync(resolve(ROOT, HOOKS_DIR))) {
  console.error(`[install-hooks] FAIL: ${HOOKS_DIR}/ not found at repo root`);
  process.exit(1);
}

run(`git config core.hooksPath ${HOOKS_DIR}`);
console.log(`[install-hooks] core.hooksPath = ${HOOKS_DIR}`);

for (const f of readdirSync(resolve(ROOT, HOOKS_DIR))) {
  if (f.startsWith('.')) continue;
  try { chmodSync(resolve(ROOT, HOOKS_DIR, f), 0o755); } catch { /* windows: no-op */ }
  try { run(`git update-index --chmod=+x ${HOOKS_DIR}/${f}`); } catch { /* not tracked yet — recorded on first commit */ }
  console.log(`[install-hooks]   + ${HOOKS_DIR}/${f} (executable)`);
}

console.log('[install-hooks] commit-scope discipline is ACTIVE.');
console.log('[install-hooks] one-off bypass: git commit --no-verify  (the PR CI still enforces it).');
