#!/usr/bin/env tsx
/**
 * run-experience-audit — CI guard. Wraps the canonical pure
 * audit at `src/governance/audit.ts` for command-line use.
 *
 *   npx tsx scripts/ci/run-experience-audit.ts
 *     → exit 0 when no hard violations
 *     → exit 1 with file:line readout when any rule fires
 *     → soft warnings printed to stderr regardless of pass/fail
 *
 * Wired into `scripts/launch-gate.mjs` so every deploy enforces
 * the experience principles end-to-end.
 *
 * The audit checks:
 *   • forbidden alarm / AI-jargon / commercial wording
 *   • forbidden legacy color literals (#22C55E, #0B1D34, etc.)
 *   • forbidden visual patterns (lime rgba / #39FF14 / neon*)
 *   • gradient stops > 3 (parens-aware so nested rgba()
 *     doesn't false-positive)
 *   • CTA density > 24 = hard fail; > 8 = soft warning
 */

import { resolve } from 'node:path';
import { runExperienceAudit } from '../../src/governance/audit.ts';

const REPO_ROOT = resolve(process.cwd());

const report = await runExperienceAudit({ rootDir: REPO_ROOT });

// Surface soft warnings regardless of pass/fail so reviewers
// see drift even when nothing's hard-failing.
const warnings = report.warnings || [];
if (warnings.length > 0) {
  console.warn(`experience-audit: ${warnings.length} soft warning(s).`);
  for (const w of warnings) {
    console.warn(`  [${w.kind}]  ${w.file}  ${w.message}`);
  }
  console.warn('');
}

if (report.ok) {
  console.log('experience-audit: all guarded files clean.');
  console.log(`  scanned ${report.summary.scanned} file(s); 0 violations.`);
  process.exit(0);
}

console.error(`experience-audit: ${report.violations.length} violation(s) found.`);
const byKind = report.summary.byKind || {};
for (const k of Object.keys(byKind)) {
  console.error(`  ${k}: ${byKind[k]}`);
}
console.error('');
for (const v of report.violations) {
  const where = v.line > 0 ? `${v.file}:${v.line}` : v.file;
  console.error(`  [${v.kind}]  ${where}  ${v.message}`);
}
console.error('');
console.error('See src/governance/ for the locked rule set.');
console.error('Use softenForGarden() (src/governance/emotionalToneRules.ts)');
console.error('and the unified design tokens (src/design/tokens/colors.js).');
process.exit(1);
