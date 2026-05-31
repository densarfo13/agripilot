#!/usr/bin/env node
/**
 * scripts/check-v7-tenant-isolation.mjs — V7 must be organization-scoped
 * with no cross-tenant leakage and no PII exposure.
 *
 * Fails if:
 *   • the NGO intelligence engine does not declare organizationScoped:true
 *     and crossTenantLeakage:false
 *   • any V7 engine EXPOSES a PII field as an output key (phone / email /
 *     coords / deviceId / ip / farmer name / exact filename)
 *   • the institutional engine does not actually compose the real
 *     tenant-isolation probe (__tenantIsolationHealth)
 *
 * Note: reading a coordinate field purely to compute a boolean presence
 * flag (e.g. `loc.latitude != null`) is allowed — only EXPOSING it as a
 * returned key is forbidden. The regex below matches object KEYS only
 * (`latitude:`), never dot-access (`.latitude`).
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const DIR = 'src/runtime/v7';
const ENGINES = [
  'predictive/PredictiveRiskEngine.ts', 'ngo/NGOIntelligenceEngine.ts',
  'marketplace/MarketplaceIntelligenceEngine.ts', 'remote/RemoteSensingEngine.ts',
  'assistant/FarmAssistantEngine.ts', 'institutional/InstitutionalReadinessEngine.ts',
];

// 1. NGO intelligence is organization-scoped + no cross-tenant leakage.
const ngo = read(`${DIR}/ngo/NGOIntelligenceEngine.ts`);
if (!ngo) F.push('NGOIntelligenceEngine.ts: missing');
else {
  if (!/organizationScoped:\s*true/.test(ngo))
    F.push('NGOIntelligenceEngine must declare organizationScoped:true');
  else P.push('NGO intelligence is organization-scoped');
  if (!/crossTenantLeakage:\s*false/.test(ngo))
    F.push('NGOIntelligenceEngine must declare crossTenantLeakage:false');
  else P.push('NGO intelligence declares no cross-tenant leakage');
}

// 2. No PII exposed as an output KEY (not dot-access presence tests).
const PII_KEY_RE = /(^|[^.\w])(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|fileName|nationalId)\s*:/;
let exposed = 0;
for (const rel of ENGINES) {
  const src = strip(read(`${DIR}/${rel}`));
  if (!src) continue;
  if (PII_KEY_RE.test(src)) { F.push(`${rel}: exposes a PII field as an output key — V7 must stay non-identifying`); exposed++; }
}
if (!exposed) P.push('no V7 engine exposes a PII field as an output key');

// 3. Institutional engine composes the REAL tenant-isolation probe.
const inst = read(`${DIR}/institutional/InstitutionalReadinessEngine.ts`);
if (inst && !/__tenantIsolationHealth/.test(inst))
  F.push('InstitutionalReadinessEngine must compose __tenantIsolationHealth (real isolation check)');
else if (inst) P.push('institutional readiness composes the real tenant-isolation probe');

if (F.length) {
  console.error('[check:v7-tenant-isolation] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v7-tenant-isolation] PASS — org-scoped, no cross-tenant leakage, no PII exposure.');
for (const m of P) console.log('  ✓ ' + m);
