/**
 * check-provider-runtime-status.mjs — P0 PROVIDER RUNTIME STATUS AUDIT §7.
 *
 * Locks the runtime-truth invariants:
 *   • the runtime status module reads the EXACT env names (+ aliases) per provider,
 *   • it exposes the full diagnostic shape + the failure taxonomy,
 *   • it NEVER classifies a keyed provider as missing_env (the core rule),
 *   • the diagnostics endpoint surfaces the per-provider flags to the client,
 *   • full secrets are never logged (fingerprint = first 6 only).
 * Runs the classifier with synthetic inputs to prove the missing_env invariant.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const MOD = 'server/src/ml/providerRuntimeStatus.js';
if (!x(MOD)) E.push('missing: ' + MOD);
const s = rd(MOD);

// Exact env names per provider (+ aliases).
for (const n of ['PLANT_ID_API_KEY', 'PLANT_API_KEY', 'CROP_HEALTH_API_KEY',
  'CROP_ID_API_KEY', 'INSECT_ID_API_KEY', 'MUSHROOM_ID_API_KEY'])
  h(s, n, 'runtime status must reference env name: ' + n);

// Full diagnostic shape.
for (const f of ['providerName', 'expectedEnvNames', 'envPresent', 'keyLength',
  'keyFingerprint', 'initialized', 'authSucceeded', 'lastHttpStatus', 'creditsKnown',
  'candidateCount', 'failureReason', 'providerReady'])
  h(s, f, 'status must include field: ' + f);

// Failure taxonomy.
for (const r of ['missing_env', 'auth_failed_401', 'forbidden_403', 'credits_exhausted',
  'rate_limited_429', 'timeout', 'provider_error', 'mapping_error', 'ready'])
  h(s, "'" + r + "'", 'failure taxonomy must include: ' + r);

h(s, 'export function classifyProviderFailure', 'must export classifyProviderFailure');
h(s, 'export function getProviderRuntimeStatus', 'must export getProviderRuntimeStatus');
h(s, 'slice(0, 6)', 'fingerprint must be first 6 chars only (no full secret)');
// No full-secret log.
if (/console\.log\([^)]*process\.env\.(PLANT|CROP|INSECT|MUSHROOM)[A-Z_]*\s*\)/.test(s))
  E.push('must not log a full key value');

// Diagnostics endpoint surfaces the per-provider flags.
const APP = rd('server/src/app.js');
h(APP, 'getProviderAcceptanceFlags', 'diagnostics endpoint must surface per-provider flags');

// The acceptance gate consumes the failure reasons.
h(rd('src/runtime/scan/acceptance/ScanAcceptanceGate.ts'), 'runtimeStatus',
  'acceptance gate must surface runtimeStatus (per-provider failure reasons)');

// ── Prove the core invariant by running the classifier (task 7). ──
if (E.length === 0) {
  const probe = `
import { classifyProviderFailure } from './server/src/ml/providerRuntimeStatus.js';
const a = classifyProviderFailure({ envPresent: true, wired: true, lastHttpStatus: 401 });
const b = classifyProviderFailure({ envPresent: true, wired: true, lastHttpStatus: 402 });
const c = classifyProviderFailure({ envPresent: false, wired: true, lastHttpStatus: null });
const d = classifyProviderFailure({ envPresent: true, wired: true, lastHttpStatus: 200 });
if (a !== 'auth_failed_401') { console.error('FAIL auth: ' + a); process.exit(1); }
if (b !== 'credits_exhausted') { console.error('FAIL credits: ' + b); process.exit(1); }
if (c !== 'missing_env') { console.error('FAIL missing: ' + c); process.exit(1); }
if (d !== 'ready') { console.error('FAIL ready: ' + d); process.exit(1); }
// The HARD rule: env present (keyLength>0) must NEVER be missing_env.
for (const st of [401, 403, 402, 429, 500, 200, null]) {
  const r = classifyProviderFailure({ envPresent: true, wired: true, lastHttpStatus: st });
  if (r === 'missing_env') { console.error('FAIL: keyed provider classified missing_env at http ' + st); process.exit(1); }
}
console.log('PROBE_OK');
`;
  try {
    fs.writeFileSync(path.join(R, '_tmp_provider_probe.mjs'), probe);
    const out = execSync('node _tmp_provider_probe.mjs', { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PROBE_OK/.test(out)) E.push('classifier probe failed: ' + out.trim());
  } catch (err) {
    E.push('classifier probe failed: ' + ((err && (err.stdout || err.message)) || 'unknown'));
  } finally {
    try { fs.unlinkSync(path.join(R, '_tmp_provider_probe.mjs')); } catch { /* */ }
  }
}

if (E.length) {
  console.error('[check:provider-runtime-status] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:provider-runtime-status] PASS — exact env names + aliases; full taxonomy; '
  + 'keyed provider NEVER classified missing_env; diagnostics surface per-provider truth; fingerprint-only.');
