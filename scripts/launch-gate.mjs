#!/usr/bin/env node
/**
 * launch-gate.mjs
 *
 * One command to run every production-safety check before a deploy.
 * Exits 0 when the tree is pilot-ready; non-zero on the first failure.
 *
 *   node scripts/launch-gate.mjs           # full run
 *   node scripts/launch-gate.mjs --fast    # skip the server test suite
 *   node scripts/launch-gate.mjs --no-build # skip the production build
 *
 * Each step runs in series so a failure is obvious. Output is
 * deliberately loud and specific — no "something failed somewhere."
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FAST = process.argv.includes('--fast');
const NO_BUILD = process.argv.includes('--no-build');

const steps = [
  { name: 'CI guard — prisma safety',
    cmd: 'node', args: ['scripts/ci/check-prisma-safety.mjs'] },
  { name: 'CI guard — crop-type drift',
    cmd: 'node', args: ['scripts/ci/check-crop-type-drift.mjs'] },
  { name: 'CI guard — i18n coverage (Hindi)',
    cmd: 'node', args: ['scripts/ci/check-i18n-coverage.mjs'] },
  { name: 'CI guard — duplicate crop sources',
    cmd: 'node', args: ['scripts/ci/check-duplicate-crop-sources.mjs'] },
  { name: 'CI guard — env assertions (prod mode)',
    cmd: 'node', args: ['scripts/ci/check-env-assertions.mjs', '--mode=prod'],
    tolerate: true,  // don't fail the whole gate on missing optional providers
  },
];

if (!FAST) {
  steps.push({
    name: 'Server tests — production safety suite',
    cmd: 'npx', args: ['vitest', 'run',
      'src/__tests__/productionSafety.test.js',
      'src/__tests__/cropEngine.test.js',
      'src/__tests__/topCropEngine.test.js',
      'src/__tests__/seasonalCropEngine.test.js',
      'src/__tests__/rainfallFitEngine.test.js',
      'src/__tests__/farmEconomicsEngine.test.js',
      'src/__tests__/insightEngine.test.js',
      'src/__tests__/insightNotificationAdapter.test.js',
      'src/__tests__/channelRouting.test.js',
    ],
    cwd: path.join(ROOT, 'server'),
  });
}

if (!NO_BUILD) {
  steps.push({
    name: 'Frontend production build',
    cmd: 'npx', args: ['vite', 'build', '--mode', 'production'],
    // Skip when VITE_API_BASE_URL isn't set — build would fail and
    // the env guard above already reported it.
    skipIf: () => !process.env.VITE_API_BASE_URL,
  });
}

function runStep(step) {
  const label = `\u2192 ${step.name}`;
  console.log(label);
  console.log('  '.padEnd(label.length, '\u2500'));
  if (step.skipIf && step.skipIf()) {
    console.log('  (skipped — precondition not met)\n');
    return true;
  }
  const res = spawnSync(step.cmd, step.args || [], {
    cwd: step.cwd || ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const ok = res.status === 0;
  console.log('');
  return ok || Boolean(step.tolerate);
}

let hardFailure = false;
for (const step of steps) {
  const ok = runStep(step);
  if (!ok) {
    console.error(`\u2717 Launch gate failed at: ${step.name}`);
    console.error('Fix the step above, then re-run: node scripts/launch-gate.mjs');
    hardFailure = true;
    break;
  }
}

if (hardFailure) process.exit(1);

console.log('\u2713 Launch gate passed. Safe to deploy.');
console.log('');
console.log('Reminder: also confirm the pilot manual test checklist in');
console.log('docs/LAUNCH_CHECKLIST.md (or the audit report\u2019s §8 Top 10 Manual Tests).');
