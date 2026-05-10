#!/usr/bin/env node
/**
 * run-experience-audit.mjs
 *
 * CI guard — runs `runExperienceAudit()` against the active
 * runtime files declared in `src/principles/gardenPrinciples.js`
 * `GARDEN_GUARDED_FILES`.
 *
 *   node scripts/ci/run-experience-audit.mjs
 *     → exit 0 when no violations
 *     → exit 1 with file:line readout when any rule fires
 *
 * Wraps the canonical pure audit at `src/governance/audit.js`.
 * The audit checks:
 *   • forbidden alarm / AI-jargon / commercial wording
 *   • forbidden legacy color literals (#22C55E, #0B1D34, etc.)
 *   • forbidden visual patterns (neon, gradient > 3 stops, lime)
 *   • CTA-density risk (> 4 `<button>` in one file)
 *
 * Wired into `scripts/launch-gate.mjs` so every deploy enforces
 * the experience principles end-to-end.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(process.cwd());
const auditUrl = pathToFileURL(
  resolve(REPO_ROOT, 'src/governance/audit.js')
).href;

let runExperienceAudit;
try {
  ({ runExperienceAudit } = await import(auditUrl));
} catch (err) {
  console.error('run-experience-audit: failed to import audit module —', err.message);
  process.exit(1);
}

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
console.error('Use softenForGarden() (src/governance/emotionalToneRules.js)');
console.error('and the unified design tokens (src/design/tokens/colors.js).');
process.exit(1);
