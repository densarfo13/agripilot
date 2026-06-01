#!/usr/bin/env node
/**
 * scripts/run-build-safe-checks.mjs — sequential gate runner.
 *
 * The Windows command-line length limit (~8191 chars) prevents the
 * full `build:safe` chain from fitting in a single npm `&&` line. This
 * runner reads the chain from package.json and executes each `npm run
 * <step>` sequentially, streaming output and failing fast on the first
 * non-zero exit. Equivalent to the prior chain — just split into N
 * spawns instead of one mega-shell line.
 *
 * Use:
 *   "build:safe": "node scripts/run-build-safe-checks.mjs"
 *
 * Reads the canonical step list from package.json `scripts.build:safe:steps`
 * (a single string of `step1 step2 ...` space-separated) so the source of
 * truth stays in package.json and is easy to diff.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const stepsRaw = (PKG.scripts && PKG.scripts['build:safe:steps']) || '';
const steps = stepsRaw.split(/\s+/).filter(Boolean);

if (!steps.length) {
  console.error('[build:safe] FAIL — package.json scripts["build:safe:steps"] is empty.');
  process.exit(2);
}

console.log(`[build:safe] running ${steps.length} steps sequentially…`);
// Use shell:true so this works uniformly on Windows (npm is `npm.cmd` and
// requires cmd.exe to resolve) and on POSIX. spawn-without-shell can return
// status:null on Windows for .cmd binaries — the chain looked like a fail.
for (const step of steps) {
  const r = spawnSync('npm', ['run', step], {
    stdio: 'inherit', cwd: ROOT, env: process.env, shell: true,
  });
  if (r.status !== 0) {
    console.error(`\n[build:safe] FAIL at step "${step}" (exit ${r.status}).`);
    process.exit(r.status || 1);
  }
}

console.log(`[build:safe] PASS — ${steps.length} steps green.`);
