/**
 * check-scan-provider-auth.mjs — P0 §9.
 *
 * Locks the provider acceptance gate: it must exist, derive readiness from the
 * REAL diagnostics envelope (never hardcode true), expose __scanAcceptanceHealth,
 * and the server diagnostics must log a FINGERPRINT only (never the full key).
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(); const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const GATE = 'src/runtime/scan/acceptance/ScanAcceptanceGate.ts';
const CONTR = 'src/runtime/scan/acceptance/ScanAcceptanceContracts.ts';
for (const f of [GATE, CONTR]) if (!x(f)) E.push('missing: ' + f);

const g = rd(GATE);
h(g, 'export function evaluateScanAcceptance', 'must export evaluateScanAcceptance');
h(g, '__scanAcceptanceHealth', 'must pin window.__scanAcceptanceHealth');
h(g, '/api/scan/diagnostics', 'acceptance must read the diagnostics endpoint (real signal)');
h(g, 'providerConfigured', 'readiness must derive from providerConfigured');
// Must NOT hardcode an all-true envelope (that would be fabricated readiness).
if (/plantIdReady:\s*true/.test(g)) E.push('plantIdReady must be computed, never hardcoded true');
if (/cropHealthReady:\s*true/.test(g)) E.push('cropHealthReady must be computed, never hardcoded true');

// Server diagnostics: fingerprint only, never the full key.
const APP = rd('server/src/app.js');
h(APP, "'/api/scan/diagnostics'", 'server must expose /api/scan/diagnostics');
h(APP, 'keyFingerprint', 'diagnostics must report a key fingerprint (first chars only)');

// No source file may print a full provider key.
for (const f of [GATE, 'server/src/ml/scanInferenceService.js']) {
  const s = rd(f);
  if (/console\.log\([^)]*(PLANT_ID_API_KEY|PLANT_API_KEY|CROP_HEALTH_API_KEY|INSECT_ID_API_KEY)\b(?![._])/.test(s)
    && !/fingerprint|length|slice|Length/i.test(s)) {
    E.push('possible full-key log in ' + f);
  }
}

if (E.length) { console.error('[check:scan-provider-auth] FAIL — ' + E.length + ' issue(s):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-provider-auth] PASS — acceptance gate derives readiness from real diagnostics; '
  + 'no hardcoded green; fingerprint-only key logging.');
