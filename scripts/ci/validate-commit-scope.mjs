#!/usr/bin/env node
/**
 * validate-commit-scope.mjs — reject commits/PRs that mix unrelated modules.
 *
 * Single enforcement point for path-ownership discipline, shared by the
 * pre-commit hook, safe-commit workflow, and CI. Reads the ownership model
 * from ./pathOwnership.mjs and fails when a change spans >1 feature group,
 * carries unexpected generated artifacts, or (in strict mode) touches unowned
 * files.
 *
 * Usage:
 *   node scripts/ci/validate-commit-scope.mjs --staged
 *   node scripts/ci/validate-commit-scope.mjs --range origin/master..HEAD
 *   node scripts/ci/validate-commit-scope.mjs --commit <sha>
 *   node scripts/ci/validate-commit-scope.mjs --files a.js b.js
 *
 * Flags:
 *   --strict-ownership   fail on files that match no ownership rule
 *   --override <reason>  downgrade MIXED_FEATURE_SCOPE to a warning (audited)
 *   --quiet              only print on violation
 *
 * Exit: 0 = clean (or overridden), 1 = violation, 2 = bad invocation.
 */
import { execSync } from 'node:child_process';
import { analyze, POLICY } from './pathOwnership.mjs';

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); } catch { return ''; }
}
function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i > 0 && i < process.argv.length - 1 ? process.argv[i + 1] : null;
}
const has = (f) => process.argv.includes(f);

const QUIET = has('--quiet');
const STRICT = has('--strict-ownership');
let override = argVal('--override');

// ─── Collect changed files from the requested source ────────────────────────
function collectFiles() {
  if (has('--files')) {
    const i = process.argv.indexOf('--files');
    return process.argv.slice(i + 1).filter((a) => !a.startsWith('--'));
  }
  const range = argVal('--range');
  if (range) return sh(`git diff --name-only ${range}`).split('\n').filter(Boolean);
  const commit = argVal('--commit');
  if (commit) {
    // Auto-read a Scope-Override trailer from the commit message.
    if (!override) {
      const body = sh(`git log -1 --format=%B ${commit}`);
      const m = body.match(new RegExp(`^${POLICY.overrideTrailer}:\\s*(.+)$`, 'mi'));
      if (m) override = m[1].trim();
    }
    return sh(`git show --name-only --format= ${commit}`).split('\n').filter(Boolean);
  }
  // Default: staged files (pre-commit).
  return sh('git diff --cached --name-only').split('\n').filter(Boolean);
}

const files = collectFiles();
if (!files.length) {
  if (!QUIET) console.log('[commit-scope] no files to validate — OK');
  process.exit(0);
}

const result = analyze(files, { strictOwnership: STRICT });

// ─── Report ─────────────────────────────────────────────────────────────────
function printSummary() {
  console.log('[commit-scope] changed files by ownership group:');
  for (const [group, fs] of Object.entries(result.byGroup)) {
    const type = result.featureGroups.includes(group) ? 'feature'
      : result.crosscutting.includes(group) ? 'crosscutting' : 'neutral';
    console.log(`  • ${group} (${type}) — ${fs.length} file(s)`);
    for (const f of fs.slice(0, 12)) console.log(`      ${f}`);
    if (fs.length > 12) console.log(`      …and ${fs.length - 12} more`);
  }
}

if (result.ok) {
  if (!QUIET) {
    printSummary();
    const scope = result.featureGroups[0] || result.crosscutting[0] || result.neutral[0] || 'none';
    console.log(`[commit-scope] PASS — single-scope change (${scope}). ${files.length} file(s).`);
  }
  process.exit(0);
}

// Violations present.
const onlyMixed = result.violations.every((v) => v.code === 'MIXED_FEATURE_SCOPE');
if (override && onlyMixed) {
  printSummary();
  console.warn(`[commit-scope] OVERRIDE — mixed-feature scope explicitly acknowledged: "${override}"`);
  console.warn('[commit-scope] (audited; prefer splitting into per-feature commits)');
  process.exit(0);
}

console.error('[commit-scope] FAIL — commit-scope discipline violated:');
printSummary();
for (const v of result.violations) {
  console.error(`  ✗ [${v.code}] ${v.message}`);
  if (v.files) for (const f of v.files.slice(0, 20)) console.error(`      ${f}`);
}
console.error('\n  How to fix:');
console.error('   • Stage only files for ONE feature. Unstage the rest:');
console.error('       git restore --staged <unrelated-file>');
console.error('   • Commit each feature separately (use: node scripts/git/safe-commit.mjs).');
console.error(`   • For a deliberate cross-scope commit, add a "${POLICY.overrideTrailer}: <reason>" trailer`);
console.error('     to the commit message (audited), or re-run with --override "<reason>".');
process.exit(1);
