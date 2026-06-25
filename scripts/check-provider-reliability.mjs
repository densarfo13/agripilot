/**
 * check-provider-reliability.mjs — PROVIDER RELIABILITY CERTIFICATION gate.
 *
 * Locks: the metrics model + migration, the reliability engine (health score
 * computed from rows, never a fake 100), the failover policy (a provider failure
 * is NEVER blocking), the admin reliability endpoint, and golden-dataset honesty
 * (empty manifest = PENDING; reject-on-accuracy-decrease; no fabricated accuracy).
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
for (const f of ['providerReliability.js', 'failoverPolicy.js'])
  if (!x(DIR + '/' + f)) E.push('missing: ' + DIR + '/' + f);

const rel = rd(DIR + '/providerReliability.js');
h(rel, 'export async function recordProviderMetric', 'must record per-call metrics');
h(rel, 'export async function getReliabilityScorecard', 'must compute the 24h scorecard');
for (const k of ['latencyP50', 'latencyP95', 'latencyP99', 'healthScore', 'healthStatus', 'farmBrainAcceptance', 'cacheHitRate'])
  h(rel, k, 'scorecard must include: ' + k);
h(rel, 'if (reqs === 0) return null', 'health score must be null with no data (no fake 100)');

const fo = rd(DIR + '/failoverPolicy.js');
h(fo, 'export function decideFailover', 'must export decideFailover');
h(fo, 'blocking: false', 'failover actions must be non-blocking (never crash scanning)');

// Schema + migration.
h(rd('server/prisma/schema.prisma'), 'model ScanProviderMetric', 'must define ScanProviderMetric model');
if (!x('server/prisma/migrations/20260625010000_scan_provider_metrics/migration.sql'))
  E.push('missing metrics migration');

// Admin endpoint.
h(rd('server/src/app.js'), "app.get('/api/admin/scan/reliability', authenticate", 'reliability endpoint must be admin/auth-only');

// Golden dataset honesty.
const gd = rd('scripts/run-golden-dataset.mjs');
h(gd, 'PENDING', 'golden-dataset must allow PENDING (empty manifest)');
h(gd, 'REGRESSION', 'golden-dataset must reject on accuracy DECREASE');
if (/(plantAccuracy|diseaseAccuracy)\s*=\s*\d{2,3}\b/.test(gd))
  E.push('golden-dataset must not hardcode/fabricate an accuracy number');
if (!x('golden-dataset/manifest.json')) E.push('missing golden-dataset/manifest.json');

// 4 reports.
for (const doc of ['PROVIDER_RELIABILITY_REPORT.md', 'SCAN_PERFORMANCE_REPORT.md',
  'GOLDEN_DATASET_REPORT.md', 'PRODUCTION_RELIABILITY_REPORT.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

// Prove: failover never blocks; health score is null with no data.
if (E.length === 0) {
  const probe = `
import { failoverNeverBlocks, decideFailover } from './server/src/services/scan/certification/failoverPolicy.js';
import { computeHealthScore, healthStatus } from './server/src/services/scan/certification/providerReliability.js';
if (!failoverNeverBlocks()) { console.error('FAIL: a provider failure is blocking'); process.exit(1); }
if (computeHealthScore({ requestCount: 0 }) !== null) { console.error('FAIL: no-data health score is not null'); process.exit(1); }
if (healthStatus(null) !== 'NO_DATA') { console.error('FAIL: no-data status wrong'); process.exit(1); }
// 100% clean → HEALTHY.
const clean = computeHealthScore({ requestCount: 100, timeoutCount:0, count401:0, count403:0, count429:0, count500:0, schemaInvalidCount:0, farmbrainRejectCount:0 });
if (healthStatus(clean) !== 'HEALTHY') { console.error('FAIL: clean run not HEALTHY: ' + clean); process.exit(1); }
// Plant.id failure → backup (never block).
const d = decideFailover('plant.id', { status:'TIMEOUT', failureReason:'timeout' });
if (d.blocking || d.action !== 'use_backup') { console.error('FAIL: plant.id failover wrong'); process.exit(1); }
console.log('PROBE_OK');
`;
  try {
    fs.writeFileSync(path.join(R, '_tmp_rel_probe.mjs'), probe);
    const out = execSync('node _tmp_rel_probe.mjs', { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PROBE_OK/.test(out)) E.push('reliability probe failed: ' + out.trim());
  } catch (err) { E.push('reliability probe failed: ' + ((err && (err.stdout || err.message)) || '?')); }
  finally { try { fs.unlinkSync(path.join(R, '_tmp_rel_probe.mjs')); } catch { /* */ } }
}

if (E.length) {
  console.error('[check:provider-reliability] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:provider-reliability] PASS — metrics model+migration; 24h scorecard (p50/p95/p99, health score '
  + 'null-on-no-data); failover never blocks; admin endpoint; golden-dataset honest (PENDING allowed, reject-on-decrease).');
