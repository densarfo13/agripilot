#!/usr/bin/env node
/**
 * validate-production-readiness.mjs — release-blocking pre-flight.
 *
 * Wraps the existing per-area gates into one fail-fast script the
 * `validate:production` npm task invokes. Does NOT replace the
 * individual gates — runs them in order and stops on the first
 * failure so CI logs stay readable.
 *
 * Steps (each fails fast):
 *   1. check:assets             (realism manifest on disk)
 *   2. check:production-assets  (required production files)
 *   3. check:url-construction   (no rogue URL building)
 *   4. check:icons              (every icon path resolves)
 *   5. check:intelligence       (getIntelligenceSnapshot facade intact)
 *   6. check:translations       (locale parity, no dupes)
 *
 * Each step's stdout/stderr is piped through; non-zero exit
 * terminates the script with the same code.
 */

import { spawnSync } from 'node:child_process';

const STEPS = [
  { name: 'check:assets',             cmd: 'npm', args: ['run', '--silent', 'check:assets'] },
  { name: 'check:production-assets',  cmd: 'npm', args: ['run', '--silent', 'check:production-assets'] },
  { name: 'check:url-construction',   cmd: 'npm', args: ['run', '--silent', 'check:url-construction'] },
  { name: 'check:icons',              cmd: 'npm', args: ['run', '--silent', 'check:icons'] },
  { name: 'check:intelligence',       cmd: 'npm', args: ['run', '--silent', 'check:intelligence'] },
  { name: 'check:translations',       cmd: 'npm', args: ['run', '--silent', 'check:translations'] },
];

function _log(line) {
  // Plain stdout — no chalk, no decoration. Logs must be scannable
  // in CI.
  process.stdout.write(line + '\n');
}

let failed = null;
for (const step of STEPS) {
  _log(`[validate:production] → ${step.name}`);
  const result = spawnSync(step.cmd, step.args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    failed = { name: step.name, code: result.status };
    break;
  }
}

if (failed) {
  _log(`[validate:production] FAIL — ${failed.name} (exit ${failed.code})`);
  process.exit(failed.code || 1);
}

_log('[validate:production] PASS — every release-blocking gate is green.');
process.exit(0);
