/**
 * check-certification-runtime-truth.mjs — CERTIFICATION RUNTIME TRUTH gate.
 *
 * Fails the build if certification could claim "Railway key missing" from a
 * local/sandbox check, if a full key could be logged, if READY is hardcoded, if
 * readiness is inferred from env alone, if the certify endpoint is public, or if
 * Sentinel Hub can block certification. Proves the runtime split by running the
 * cert from this (sandbox) context: it MUST report LOCAL_SECRETS_UNAVAILABLE,
 * never NOT_CONFIGURED.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const RC = 'server/src/services/scan/certification/runtimeContext.js';
const CERT = 'server/src/services/scan/certification/providerCertification.js';
for (const f of [RC, CERT, 'src/runtime/certification/RuntimeContext.ts', 'scripts/run-scan-certification.mjs', 'CERTIFICATION_RUNBOOK.md'])
  if (!x(f)) E.push('missing: ' + f);

const rc = rd(RC);
h(rc, 'canAccessProviderSecrets', 'runtime context must expose canAccessProviderSecrets');
h(rc, 'RAILWAY_ENVIRONMENT', 'runtime context must detect the Railway runtime');

const cert = rd(CERT);
// The exact states must exist, incl. the honest local one.
for (const st of ['LOCAL_SECRETS_UNAVAILABLE', 'NOT_CONFIGURED', 'AUTH_FAILED', 'CREDITS_EXHAUSTED',
  'RATE_LIMITED', 'TIMEOUT', 'SCHEMA_INVALID', 'FARMBRAIN_REJECTED', 'READY', 'DEGRADED', 'DISABLED'])
  h(cert, st + ':', 'cert states must include: ' + st);
// Key check must be length/fingerprint only.
h(cert, 'slice(0, 6)', 'key check must use fingerprint (first 6) only');
if (/console\.log\([^)]*process\.env\.[A-Z_]*API_KEY(?![^)]*(slice|fingerprint|keyLength|length))/.test(cert))
  E.push('must never log a full API key value');
// READY assigned exactly once (the evidence conjunction).
if ((cert.match(/status\s*=\s*CERT_STATUS\.READY\s*;/g) || []).length !== 1)
  E.push('READY must be assigned exactly once (evidence conjunction)');

// Endpoint admin-only + returns runtime context + nextAction.
const APP = rd('server/src/app.js');
h(APP, "app.post('/api/admin/scan/certify', authenticate", 'certify endpoint must be admin/auth-only (not public)');
h(APP, 'runtimeContext', 'certify endpoint must return runtimeContext');
h(APP, 'nextAction', 'certify endpoint must return nextAction');

// Sentinel optional.
h(rd('server/src/services/scan/certification/providerScorecard.js'), 'never reduce', 'Sentinel/optional must never reduce the verdict');

// ── Prove the runtime split from THIS (sandbox) context. ──
if (E.length === 0) {
  const probe = `
import { runProductionCertification } from './server/src/services/scan/certification/productionCertification.js';
const r = await runProductionCertification({});
// In a local/sandbox context with no injected secrets, providers must be
// LOCAL_SECRETS_UNAVAILABLE — NEVER NOT_CONFIGURED (which would falsely claim keys missing).
const bad = r.certifications.find((c) => c.provider !== 'sentinel_hub' && c.status === 'NOT_CONFIGURED');
if (bad) { console.error('FAIL: claimed NOT_CONFIGURED (keys missing) from a no-secret local check: ' + bad.provider); process.exit(1); }
if (r.overall === 'PRODUCTION_CERTIFIED') { console.error('FAIL: certified with no live evidence'); process.exit(1); }
if (!r.nextAction || !/railway run/.test(r.nextAction)) { console.error('FAIL: missing railway-run next action'); process.exit(1); }
console.log('PROBE_OK ' + r.overall);
`;
  try {
    fs.writeFileSync(path.join(R, '_tmp_rt_probe.mjs'), probe);
    const out = execSync('node _tmp_rt_probe.mjs', { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PROBE_OK/.test(out)) E.push('runtime-truth probe failed: ' + out.trim());
  } catch (err) { E.push('runtime-truth probe failed: ' + ((err && (err.stdout || err.message)) || '?')); }
  finally { try { fs.unlinkSync(path.join(R, '_tmp_rt_probe.mjs')); } catch { /* */ } }
}

if (E.length) {
  console.error('[check:certification-runtime-truth] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:certification-runtime-truth] PASS — local check reports LOCAL_SECRETS_UNAVAILABLE (never falsely '
  + '"keys missing"); endpoint admin-only + runtime context; no full-key logging; READY not hardcoded; Sentinel non-blocking.');
