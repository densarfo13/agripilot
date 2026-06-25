/**
 * check-environment-orchestrator.mjs — Environment Provider Orchestrator gate.
 *
 * Covers the four spec gates in one pass:
 *   • check-ambee-pollen-v3   → no deprecated/fabricated pollen endpoint; the
 *     hardened Soil service has telemetry + timeout + diagnostics.
 *   • check-environment-provider-health → orchestrator + 3 health globals +
 *     Soil as the first production provider + pluggable interface.
 *   • check-environment-no-provider-jargon → no Ambee/API/provider/v3 in the
 *     farmer-facing risk/orchestrator wording.
 *   • check-environment-cache → 6h TTL + circuit breaker + retry.
 * Runs the orchestrator's verdict test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

// ── Hardened Soil service (the real Ambee dependency). ──
const SOIL = 'server/src/services/soil/ambeeSoilService.js';
if (!x(SOIL)) E.push('missing: ' + SOIL); else { const s = rd(SOIL);
  h(s, 'getSoilProviderDiagnostics', 'soil service must expose diagnostics (telemetry)');
  h(s, 'AbortController', 'soil service must have a request timeout');
  h(s, 'auth_failed_401', 'soil diagnostics must classify failure reasons');
  h(s, "slice(0, 6)", 'soil fingerprint must be first 6 chars only (no full secret)');
  h(s, 'CACHE_TTL_MS = 6', 'soil cache TTL must be 6 hours');
}

// ── Orchestrator + contracts + risk engine. ──
const ORCH = 'src/runtime/environment/EnvironmentOrchestrator.ts';
const CONTRACTS = 'src/runtime/environment/EnvironmentContracts.ts';
const RISK = 'src/runtime/environment/EnvironmentRiskEngine.ts';
for (const f of [ORCH, CONTRACTS, RISK]) if (!x(f)) E.push('missing: ' + f);
const orch = rd(ORCH);
h(orch, 'registerEnvironmentProvider', 'orchestrator must support pluggable providers');
h(orch, 'circuit', 'orchestrator must have a circuit breaker');
h(orch, 'CB_THRESHOLD', 'orchestrator must have a circuit-breaker threshold');
for (const g of ['__environmentProviderHealth', '__ambeePollenHealth', '__farmBrainEnvironmentHealth'])
  h(orch, g, 'must install health global: ' + g);
h(orch, "domain: 'soil', priority: 10", 'Soil must be the first (highest-priority) production provider');
h(orch, 'enabled: false', 'pollen must be a DISABLED stub (no fabrication)');
h(rd(CONTRACTS), 'EnvironmentProvider', 'contracts must define the EnvironmentProvider interface');

// ── No deprecated/fabricated pollen endpoint anywhere. ──
const pollenEndpoint = /https?:\/\/[^\s'"]*pollen[^\s'"]*/i;
for (const f of [ORCH, RISK, CONTRACTS, SOIL]) {
  if (pollenEndpoint.test(rd(f))) E.push('no live pollen endpoint may be wired (no fabricated dependency): ' + f);
}

// ── Farmer-facing wording: no provider/API jargon in farmer-visible STRINGS. ──
// Scan only quoted sentence-like string literals (what a farmer could read), not
// code identifiers (e.g. the `provider:` field name in the envelope is fine).
const risk = rd(RISK);
const BANNED = [/\bAmbee\b/i, /\bAPI\b/, /\bv3\b/, /\bKindwise\b/i, /\bprovider\b/i, /\bmodel\b/i];
// Single-line literals only (no newline spanning), then keep just sentence-shaped
// farmer copy: starts uppercase, contains spaced words, ends with . ! or ?
// Enum/field strings ('provider', 'ready', 'soil') fail this shape.
const literals = risk.match(/'[^'\n]{12,}'|"[^"\n]{12,}"/g) || [];
for (const lit of literals) {
  const text = lit.slice(1, -1);
  if (!/^[A-Z][^]*[a-z]\s[a-z][^]*[.!?]$/.test(text)) continue;   // farmer sentence only
  for (const re of BANNED) if (re.test(text))
    E.push('farmer-facing string must not contain provider/API jargon: ' + lit);
}

// ── FarmBrain must never be blocked by the environment layer. ──
h(orch, 'blocksFarmBrain: false', 'env health must attest it never blocks FarmBrain');

// ── Server endpoints (admin diagnostics + public-safe health). ──
const APP = rd('server/src/app.js');
h(APP, "'/api/environment/diagnostics'", 'must mount admin GET /api/environment/diagnostics');
h(APP, "'/api/environment/health'", 'must mount public GET /api/environment/health');
if (/\/api\/environment\/health[\s\S]{0,400}keyFingerprint/.test(APP))
  E.push('public /api/environment/health must NOT leak key fingerprint or secrets');

// ── Run the orchestrator test. ──
const TEST = 'src/runtime/environment/__tests__/EnvironmentOrchestrator.test.ts';
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('orchestrator test did not PASS: ' + out.trim());
  } catch (err) { E.push('orchestrator test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:environment-orchestrator] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:environment-orchestrator] PASS — Soil hardened (telemetry/timeout/diagnostics); '
  + 'pluggable orchestrator w/ circuit breaker; Soil-first; pollen disabled stub (no fabrication); '
  + 'no farmer jargon; admin+public endpoints; FarmBrain never blocked; test green.');
