/**
 * check-scan-production-certification.mjs — PRODUCTION CERTIFICATION gate.
 *
 * Fails the build on the spec's forbidden shortcuts: fake confidence, hardcoded
 * READY, skipped validation/auth/FarmBrain. Verifies the framework + endpoint +
 * migration exist, and that readiness is COMPUTED from live evidence (a sandbox
 * run with no keys must NOT be PRODUCTION_CERTIFIED).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const DIR = 'server/src/services/scan/certification';
const FILES = ['providerCertification.js', 'providerValidator.js', 'providerHealthMonitor.js',
  'providerScorecard.js', 'productionCertification.js'];
for (const f of FILES) if (!x(DIR + '/' + f)) E.push('missing: ' + DIR + '/' + f);

const cert = rd(DIR + '/providerCertification.js');
// Status is computed; READY requires the full evidence conjunction.
h(cert, 'authenticated && schemaValid && parsedOk && farmBrainAccepted && underSla', 'READY must require auth+schema+parse+FarmBrain+SLA (no shortcut)');
// READY may be ASSIGNED exactly once — inside the evidence conjunction above.
{
  const readyAssigns = (cert.match(/status\s*=\s*CERT_STATUS\.READY\s*;/g) || []).length;
  if (readyAssigns !== 1) E.push('READY must be assigned exactly once (the evidence conjunction), found ' + readyAssigns);
}
// No fabricated confidence/score literals in the cert logic (illustrative %s belong in docs only).
if (/(confidence|avgConfidence|score)\s*[:=]\s*(9[0-9]|100)\b/.test(cert + rd(DIR + '/productionCertification.js')))
  E.push('no fabricated confidence/score literal may appear in the certification logic');

// Validator must check auth + schema + FarmBrain acceptance (no skipping).
const val = rd(DIR + '/providerValidator.js');
for (const k of ['authenticated', 'schemaValid', 'farmBrainAccepted'])
  h(val, k, 'validator must evaluate: ' + k);

// Sentinel optional + never blocks.
const sc = rd(DIR + '/providerScorecard.js');
h(sc, 'never reduce', 'scorecard must state optional providers never reduce the verdict');
h(rd(DIR + '/providerCertification.js'), "'sentinel_hub': { maxLatencyMs: 8000, minConfidence: 0,  required: false", 'Sentinel Hub must be OPTIONAL (required:false)');

// Endpoint + persistence.
const APP = rd('server/src/app.js');
h(APP, "'/api/admin/scan/certify'", 'must mount POST /api/admin/scan/certify');
h(rd('server/prisma/schema.prisma'), 'model ScanProviderCertification', 'must define the certification model');
if (!x('server/prisma/migrations/20260625000000_scan_provider_certifications/migration.sql'))
  E.push('missing certification migration');

// 4 reports.
for (const doc of ['SCAN_CERTIFICATION.md', 'PROVIDER_SCORECARD.md', 'PRODUCTION_CERTIFICATION.md', 'SCAN_PERFORMANCE.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

// Live-evidence proof: a no-key run must NOT be PRODUCTION_CERTIFIED (never env-inferred).
if (E.length === 0) {
  const probe = `
import { runProductionCertification } from './server/src/services/scan/certification/productionCertification.js';
const r = await runProductionCertification({});
if (r.overall === 'PRODUCTION_CERTIFIED') { console.error('FAIL: certified with no live evidence'); process.exit(1); }
// A simulated all-green live run MUST be able to certify (proves the path is real, not stubbed false).
const live = {}; for (const p of ['plant.id','crop.health','insect.id','weather','soil'])
  live[p] = { configured:true, httpStatus:200, latencyMs:100, schemaValid:true, parsedOk:true, confidence:90, farmBrainAccepted:true, creditsOk:true };
const r2 = await runProductionCertification({ liveCall: live });
if (r2.overall !== 'PRODUCTION_CERTIFIED') { console.error('FAIL: all-green live run did not certify: ' + r2.overall); process.exit(1); }
console.log('PROBE_OK');
`;
  try {
    fs.writeFileSync(path.join(R, '_tmp_cert_probe.mjs'), probe);
    const out = execSync('node _tmp_cert_probe.mjs', { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PROBE_OK/.test(out)) E.push('cert probe failed: ' + out.trim());
  } catch (err) { E.push('cert probe failed: ' + ((err && (err.stdout || err.message)) || '?')); }
  finally { try { fs.unlinkSync(path.join(R, '_tmp_cert_probe.mjs')); } catch { /* */ } }
}

if (E.length) {
  console.error('[check:scan-production-certification] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-production-certification] PASS — live-evidence cert (no hardcoded READY / fake confidence / '
  + 'skipped auth+FarmBrain); Sentinel optional; endpoint+model+migration; no-key run NOT certified, all-green run IS.');
