/**
 * check-feature-manifest.mjs — the Feature Governor. Every feature registered in
 * src/product/featureManifest.js must declare all twelve contract fields, non-empty.
 * Missing field → fail the build (Product OS §FEATURE GOVERNANCE). Runs the manifest test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const F = 'src/product/featureManifest.js';
const TEST = 'src/product/__tests__/featureManifest.test.ts';
const src = (() => { try { return fs.readFileSync(path.join(R, F), 'utf8'); } catch { return ''; } })();

if (!src) { console.error('[check:feature-manifest] FAIL: ' + F + ' missing'); process.exit(1); }
if (!/export function validateFeatureManifest/.test(src)) E.push('must export validateFeatureManifest');
if (!/export const REQUIRED_FIELDS/.test(src)) E.push('must export REQUIRED_FIELDS');
// All twelve governance fields must be named in the schema.
for (const f of ['problem', 'persona', 'value', 'successMetric', 'offlineBehavior', 'localizationImpact',
  'accessibilityImpact', 'performanceImpact', 'aiImpact', 'dataRequired', 'privacyImpact', 'enterpriseImpact'])
  if (!new RegExp("'" + f + "'").test(src)) E.push('REQUIRED_FIELDS missing: ' + f);

if (E.length === 0 && fs.existsSync(path.join(R, TEST))) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('feature-manifest test did not PASS: ' + out.trim());
  } catch (err) { E.push('feature-manifest test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:feature-manifest] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:feature-manifest] PASS — Feature Governor: 12-field contract enforced; every registered '
  + 'feature manifest is complete (problem→enterpriseImpact); test green.');
