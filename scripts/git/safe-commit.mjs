#!/usr/bin/env node
/**
 * safe-commit.mjs — disciplined replacement for blanket auto-commit.
 *
 * Flow:  PREVIEW → VALIDATE → COMMIT → VERIFY → (PUSH)
 *
 * Usage:
 *   node scripts/git/safe-commit.mjs -m "fix(ngo): ..." [file ...] [--push] [--override "reason"]
 *
 *   • With explicit files → stages ONLY those (never `git add -A`).
 *   • Without files       → uses whatever is already staged.
 *   • Refuses: protected branch (master/main), empty stage, mixed-feature
 *     scope, and (via the pre-commit hook) partial staging.
 *
 * This is the tool the deploy/automation should call instead of
 * "git add -A && git commit -m ... && git push". See RELEASE_GUARD.md.
 */
import { execSync, spawnSync } from 'node:child_process';

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const step = (n, t) => console.log(`\n[safe-commit] ${n} ── ${t}`);
const die = (m) => { console.error(`[safe-commit] ABORT: ${m}`); process.exit(1); };

const argv = process.argv.slice(2);
const mi = argv.indexOf('-m');
const message = mi >= 0 ? argv[mi + 1] : null;
if (!message) die('missing  -m "<commit message>"');
const PUSH = argv.includes('--push');
const oi = argv.indexOf('--override');
const override = oi >= 0 ? argv[oi + 1] : null;
const consumed = new Set([mi, mi + 1, oi, oi + 1].filter((x) => x >= 0));
const files = argv.filter((a, i) => !consumed.has(i) && !a.startsWith('--'));

const branch = sh('git rev-parse --abbrev-ref HEAD');
if (['master', 'main'].includes(branch) && process.env.ALLOW_COMMIT_TO_MASTER !== '1') {
  die(`refusing to commit on protected branch '${branch}'. Use a feature branch + PR (RELEASE_GUARD.md).`);
}

// 1 ── PREVIEW ──────────────────────────────────────────────────────────────
step('1/5', 'PREVIEW');
if (files.length) {
  console.log(`  staging ${files.length} explicit file(s):`);
  files.forEach((f) => console.log(`    ${f}`));
  const add = spawnSync('git', ['add', '--', ...files], { stdio: 'inherit' });
  if (add.status !== 0) die('git add failed.');
} else {
  console.log('  using already-staged files (no explicit files passed).');
}
const staged = sh('git diff --cached --name-only').split('\n').filter(Boolean);
if (!staged.length) die('nothing staged — pass the files to commit, or stage them first.');
console.log(sh('git diff --cached --stat'));

// 2 ── VALIDATE ─────────────────────────────────────────────────────────────
step('2/5', 'VALIDATE (scope discipline)');
const vArgs = ['scripts/ci/validate-commit-scope.mjs', '--staged'];
if (override) vArgs.push('--override', override);
if (spawnSync('node', vArgs, { stdio: 'inherit' }).status !== 0) die('scope validation failed (above).');

// 3 ── COMMIT ───────────────────────────────────────────────────────────────
step('3/5', 'COMMIT');
let full = message;
if (override && !/^Scope-Override:/mi.test(message)) full += `\n\nScope-Override: ${override}`;
if (spawnSync('git', ['commit', '-m', full], { stdio: 'inherit' }).status !== 0) die('git commit failed.');

// 4 ── VERIFY ───────────────────────────────────────────────────────────────
step('4/5', 'VERIFY');
const head = sh('git rev-parse HEAD');
console.log(`  HEAD = ${head.slice(0, 8)} on ${branch}`);
const reVerify = spawnSync('node',
  ['scripts/ci/validate-commit-scope.mjs', '--commit', head, '--quiet'], { stdio: 'inherit' });
if (reVerify.status !== 0) console.warn('[safe-commit] NOTE: commit re-validates as mixed (override in effect).');
console.log(sh(`git show --stat --oneline ${head}`).split('\n').slice(0, 10).join('\n'));

// 5 ── PUSH ─────────────────────────────────────────────────────────────────
step('5/5', 'PUSH');
if (!PUSH) { console.log('  skipped — re-run with --push, or: git push -u origin ' + branch); process.exit(0); }
if (spawnSync('git', ['push', '-u', 'origin', branch], { stdio: 'inherit' }).status !== 0) die('git push failed.');
console.log('\n[safe-commit] ✔ committed + pushed a single-scope change.');
