#!/usr/bin/env node
/**
 * check-continuity-coverage.mjs — wave 5 CI ratchet.
 *
 *   node scripts/check-continuity-coverage.mjs
 *
 * What this verifies
 * ──────────────────
 *   • src/runtime/continuity/continuityRuntime.js exists and exports
 *     `installContinuityRuntime`, `getContinuityHealth`,
 *     `getStateOwnershipReport`, `CANONICAL_WRITERS`.
 *   • Every PERSISTENCE_DOMAIN value declared in
 *     src/runtime/persistence/persistenceRuntime.js has an entry in
 *     CANONICAL_WRITERS (no domain left without a registered owner
 *     in the source).
 *   • The four wave-5 diagnostics are wired in
 *     src/lib/weatherAndLanguageDiagnostics.js:
 *       __continuityHealth, __syncHealth, __eventIntegrity,
 *       __stateOwnership
 *   • The continuity runtime is installed in src/App.jsx.
 *
 * This is a HARD gate — no baseline, no grandfathering. A
 * misconfiguration that drops a domain from the registry, removes
 * a diagnostic, or skips the install fails the build with a clear
 * remediation pointer.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:continuity-coverage]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

function fail(message, details) {
  console.error(HEADER, 'FAIL — ' + message);
  if (details) console.error('  ' + details);
  process.exit(1);
}

// 1) Required files exist.
const PR_PATH = 'src/runtime/persistence/persistenceRuntime.js';
const CR_PATH = 'src/runtime/continuity/continuityRuntime.js';
const SR_PATH = 'src/runtime/sync/syncRuntime.js';
const ER_PATH = 'src/runtime/events/eventRuntime.js';
const DG_PATH = 'src/lib/weatherAndLanguageDiagnostics.js';
const APP_PATH = 'src/App.jsx';

const pr = _read(PR_PATH);
const cr = _read(CR_PATH);
const sr = _read(SR_PATH);
const er = _read(ER_PATH);
const dg = _read(DG_PATH);
const app = _read(APP_PATH);

if (!pr) fail('missing ' + PR_PATH);
if (!cr) fail('missing ' + CR_PATH);
if (!sr) fail('missing ' + SR_PATH);
if (!er) fail('missing ' + ER_PATH);
if (!dg) fail('missing ' + DG_PATH);
if (!app) fail('missing ' + APP_PATH);

// 2) Continuity runtime exports the required surface.
const REQUIRED_CR_EXPORTS = [
  'installContinuityRuntime',
  'getContinuityHealth',
  'getStateOwnershipReport',
  'CANONICAL_WRITERS',
];
for (const sym of REQUIRED_CR_EXPORTS) {
  if (!new RegExp('export\\s+(function|const)\\s+' + sym + '\\b').test(cr)) {
    fail('continuityRuntime missing export: ' + sym);
  }
}

// 3) Persistence registry exports + every domain in
//    PERSISTENCE_DOMAIN is referenced by CANONICAL_WRITERS in
//    the continuity runtime.
const domainBlock = pr.match(
  /export\s+const\s+PERSISTENCE_DOMAIN\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
if (!domainBlock) fail('PERSISTENCE_DOMAIN block not found in ' + PR_PATH);
const domainKeys = [];
for (const m of domainBlock[1].matchAll(/^\s*([A-Z_]+)\s*:/gm)) {
  domainKeys.push(m[1]);
}
if (domainKeys.length === 0) {
  fail('no domain keys parsed from ' + PR_PATH);
}
for (const key of domainKeys) {
  if (!new RegExp('PERSISTENCE_DOMAIN\\.' + key + '\\b').test(cr)) {
    fail('continuityRuntime CANONICAL_WRITERS missing domain: '
      + key, 'add an entry for PERSISTENCE_DOMAIN.' + key);
  }
}

// 4) Four diagnostics wired.
const REQUIRED_DIAGNOSTICS = [
  '__continuityHealth',
  '__syncHealth',
  '__eventIntegrity',
  '__stateOwnership',
];
for (const d of REQUIRED_DIAGNOSTICS) {
  if (!new RegExp('window\\.' + d + '\\s*=').test(dg)) {
    fail('diagnostic ' + d + ' not wired in ' + DG_PATH);
  }
}

// 5) Continuity runtime installed in App.jsx mount.
if (!/installContinuityRuntime\s*\(\s*\)/.test(app)) {
  fail('App.jsx does not call installContinuityRuntime() during boot');
}

console.log(HEADER, 'PASS — wave 5 continuity coverage complete.');
console.log('  ' + domainKeys.length + ' persistence domain(s) registered.');
console.log('  4 diagnostics wired. Runtime install present.');
process.exit(0);
