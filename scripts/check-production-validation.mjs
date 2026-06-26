/**
 * check-production-validation.mjs — production scan-validation pipeline gate.
 *
 * Locks: the 7-bucket failure classifier; the per-scan ScanProviderMetric persistence
 * wired into /api/scan/analyze; the Production Validation Report builder that NEVER
 * promotes to GO without real evidence; and the operator command. Runs the vitest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const FAIL = 'server/src/services/scan/certification/providerFailure.js';
const VAL = 'server/src/services/scan/certification/productionValidation.js';
const RUN = 'scripts/run-production-validation.mjs';
const TEST = 'server/src/__tests__/productionValidation.test.js';
for (const f of [FAIL, VAL, RUN, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

// 1. The 7 canonical failure categories + classifier + recommendations.
const fail = rd(FAIL);
for (const c of ['AUTH', 'CREDITS', 'RATE_LIMIT', 'NETWORK', 'INVALID_RESPONSE', 'TIMEOUT', 'UNKNOWN'])
  has(fail, c, 'failure classifier must define category ' + c);
has(fail, 'export function classifyProviderFailure', 'must export classifyProviderFailure');
has(fail, 'export function recommendationFor', 'must export recommendationFor');

// 2. Per-scan ScanProviderMetric persistence wired into the scan route.
const app = rd('server/src/app.js');
has(app, 'recordProviderMetric', 'app.js /api/scan/analyze must persist a ScanProviderMetric per provider');
has(app, 'classifyProviderFailure', 'app.js must classify provider failures into the 7 buckets');
if (!/never blocks a scan/i.test(app)) E.push('the metric persistence must be documented as non-blocking (fire-and-forget)');

// 3. Report builder: honest, evidence-gated promotion.
const val = rd(VAL);
has(val, 'export function buildProductionValidationReport', 'must export buildProductionValidationReport');
has(val, 'INSUFFICIENT_EVIDENCE', 'report must have an INSUFFICIENT_EVIDENCE verdict (no evidence → never GO)');
has(val, "CRITICAL_PROVIDERS", 'report must define the critical providers that gate GO');
if (!/verdict\s*=\s*'GO'/.test(val) || !/criticalReady/.test(val)) E.push('GO must require every critical provider READY');

// 4. NETWORK added to the certification taxonomy.
has(rd('server/src/services/scan/certification/providerCertification.js'), "NETWORK: 'NETWORK'", 'CERT_STATUS must include NETWORK');

// 5. Operator command registered.
has(rd('package.json'), 'scan:validate', 'package.json must register the scan:validate command');

// 6. Run the vitest suite.
if (E.length === 0) {
  try {
    const out = execSync('npx vitest run src/__tests__/productionValidation.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('production-validation vitest did not pass:\n' + out.slice(-500));
  } catch (err) { E.push('production-validation vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-500)); }
}

if (E.length) {
  console.error('[check:production-validation] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:production-validation] PASS — 7-bucket failure classifier; per-scan ScanProviderMetric persisted into '
  + '/api/scan/analyze (non-blocking); evidence-gated GO/NO-GO report (never GO without real evidence); scan:validate command; vitest green.');
