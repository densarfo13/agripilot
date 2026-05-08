// Helper: count + list files with react-hooks violations.
// Exits 1 if any rules-of-hooks errors are found, OR if the
// exhaustive-deps count EXCEEDS the pre-existing baseline.
//
// Used by `npm run lint:hooks` — narrower than full ESLint so
// we only enforce the hook rules without surfacing unrelated
// parse errors (.ts files without a TS parser), unused-disable
// directive warnings, etc.
//
// RULES
// ─────
//   react-hooks/rules-of-hooks  — zero tolerance. Any violation
//     is a hard CI failure that must be fixed immediately.
//
//   react-hooks/exhaustive-deps — baseline-capped. Pre-existing
//     violations (120 at time of Safe Runtime Layer commit) are
//     tracked but not yet enforced one by one. The gate fails
//     only when the count RISES above the baseline — i.e., a new
//     PR cannot ADD new missing-dep bugs. Reducing the count is
//     always welcome; it lowers the effective baseline for the
//     next audit.
//
// HOW TO CLEAR A VIOLATION
// ─────────────────────────
//   Option A — fix the hook: add missing deps or wrap function
//     in useCallback so ESLint is satisfied.
//   Option B — intentional exclusion: add
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     on the line immediately before the closing }, [deps]);
//     and include a comment explaining WHY the dep is excluded.

import { ESLint } from 'eslint';

// ── Baseline ──────────────────────────────────────────────────────
// Pre-existing exhaustive-deps violations at the time of the
// Safe Runtime Layer commit (20f836c, May 2026). Reducing this
// number is always good; raising it fails CI.
const EXHAUSTIVE_DEPS_BASELINE = 100; // measured after Safe Runtime Layer + 3 targeted fixes

// ─────────────────────────────────────────────────────────────────

const eslint = new ESLint({
  overrideConfig: [
    {
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'error',
      },
    },
  ],
});

const results = await eslint.lintFiles(['src']);

let hooksErrors     = 0;
let exhaustiveCount = 0;
const hooksBuckets      = new Map(); // path -> rules-of-hooks count
const exhaustiveBuckets = new Map(); // path -> exhaustive-deps count

for (const r of results) {
  for (const m of r.messages) {
    const rel = r.filePath.replace(/.*[\\/]src[\\/]/, 'src/').replace(/\\/g, '/');
    if (m.ruleId === 'react-hooks/rules-of-hooks' && m.severity === 2) {
      hooksBuckets.set(rel, (hooksBuckets.get(rel) || 0) + 1);
      hooksErrors += 1;
    }
    if (m.ruleId === 'react-hooks/exhaustive-deps' && m.severity === 2) {
      exhaustiveBuckets.set(rel, (exhaustiveBuckets.get(rel) || 0) + 1);
      exhaustiveCount += 1;
    }
  }
}

// ── Report: rules-of-hooks ────────────────────────────────────────
if (hooksBuckets.size > 0) {
  console.log('\nrules-of-hooks violations (must fix):');
  [...hooksBuckets.keys()].sort().forEach((f) => {
    console.log(String(hooksBuckets.get(f)).padStart(3) + '  ' + f);
  });
}
console.log('---');
console.log('rules-of-hooks  files:  ' + hooksBuckets.size);
console.log('rules-of-hooks  errors: ' + hooksErrors);

// ── Report: exhaustive-deps ───────────────────────────────────────
const overBaseline = exhaustiveCount > EXHAUSTIVE_DEPS_BASELINE;
if (exhaustiveBuckets.size > 0) {
  const label = overBaseline ? '⚠  exhaustive-deps violations (above baseline):' :
    '✓  exhaustive-deps violations (within baseline ' + EXHAUSTIVE_DEPS_BASELINE + '):';
  console.log('\n' + label);
  [...exhaustiveBuckets.keys()].sort().forEach((f) => {
    console.log(String(exhaustiveBuckets.get(f)).padStart(3) + '  ' + f);
  });
}
console.log('---');
console.log('exhaustive-deps violations: ' + exhaustiveCount +
  ' (baseline ' + EXHAUSTIVE_DEPS_BASELINE + ')');
if (overBaseline) {
  console.log('  ↑ ' + (exhaustiveCount - EXHAUSTIVE_DEPS_BASELINE) +
    ' new violation(s) above baseline — fix before merging.');
}

// ── Exit code ─────────────────────────────────────────────────────
if (hooksErrors > 0 || overBaseline) process.exit(1);
