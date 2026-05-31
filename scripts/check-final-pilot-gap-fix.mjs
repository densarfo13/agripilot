#!/usr/bin/env node
/**
 * scripts/check-final-pilot-gap-fix.mjs — consolidated launch/pilot
 * gap gate (Final Pilot Gap Fix §12).
 *
 * Fails if any of the ten pilot guarantees regress:
 *   1. mobile Scan nav must route to /scan?mode=camera + render the
 *      camera-like shell (no intro card)
 *   2. upload must auto-analyze (no Analyze button gate)
 *   3. camera failure must keep an Upload fallback
 *   4. existing-user login must route Home (RouteGuard role-only)
 *   5. /api/health polling ≥ 60s
 *   6. auth refresh must have a 429 backoff (degraded mode)
 *   7. persistence validation must exist (validate:persistence)
 *   8. invite validation must never fake delivery
 *   9. outcome-capture diagnostic must exist
 *  10. the four validation diagnostics must be present + wired
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const pkg  = (() => { try { return JSON.parse(read('package.json')); } catch { return {}; } })();

// ─── 1. mobile scan camera-first routing ───────────────────────
const nav = read('src/components/farmer/BottomTabNav.jsx');
if (!/mode=camera/.test(nav)) {
  fail('§1 mobile Scan nav must route to /scan?mode=camera');
} else {
  pass('§1 mobile Scan nav routes to /scan?mode=camera');
}
const scanPage = read('src/pages/ScanPage.jsx');
if (!/<ScanCameraLikeShell/.test(scanPage) || !/mode'?\)?\s*===\s*'camera'|=== 'camera'/.test(scanPage)) {
  fail('§1 ScanPage must render the camera-like shell for mobile / mode=camera');
} else {
  pass('§1 ScanPage renders the camera-like shell (mobile / mode=camera)');
}

// ─── 2. upload auto-analysis (no Analyze button gate) ──────────
if (!/_handleEntryFilePicked/.test(scanPage) || !/onContinue\(/.test(scanPage)) {
  fail('§2 ScanPage upload must auto-analyze via onContinue (no Analyze button)');
} else {
  pass('§2 upload auto-analyzes (onContinue fires on file select)');
}

// ─── 3. camera failure keeps Upload fallback ───────────────────
const fallback = read('src/components/scan/ScanFallback.jsx');
if (!/data-testid=["']scan-fallback-upload["']/.test(fallback)) {
  fail('§3 ScanFallback must keep an Upload Photo fallback');
} else {
  pass('§3 camera-failure fallback keeps Upload Photo');
}

// ─── 4. login routes Home; RouteGuard role-only ────────────────
const guard = read('src/components/auth/RouteGuard.jsx')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
if (/\bonboardingComplete\b|!\s*hasLocation\b|!\s*country\b/.test(guard)) {
  fail('§4 RouteGuard must NOT gate on location/onboarding (existing user → Home)');
} else {
  pass('§4 RouteGuard gates on role only (existing user routes Home)');
}
const login = read('src/runtime/loginRouting/LoginRoutingHealthRuntime.ts');
if (!/existingUserRoutesHome/.test(login) || !/noLocationLoop/.test(login)) {
  fail('§4 __loginRoutingHealth must surface existingUserRoutesHome + noLocationLoop');
}

// ─── 5. /api/health polling ≥ 60s ──────────────────────────────
const persist = read('src/runtime/persistence/PersistenceHealth.ts');
if (!/HEALTH_POLL_MIN_MS/.test(persist) || !/_HEALTH_THROTTLE_MS\s*=\s*60_?000/.test(persist)) {
  fail('§5 /api/health must be throttled to ≥ 60s (HEALTH_POLL_MIN_MS)');
} else {
  pass('§5 /api/health polling throttled to ≥ 60s');
}

// ─── 6. auth refresh 429 backoff ───────────────────────────────
const api = read('src/lib/api.js');
if (!/_enterDegraded/.test(api) || !/_DEGRADED_BACKOFF_MS/.test(api) || !/_isTransientStatus/.test(api)) {
  fail('§6 auth refresh must enter degraded mode with backoff on 429/5xx');
} else {
  pass('§6 auth refresh has 429/5xx degraded-mode backoff');
}

// ─── 7. persistence validation present ─────────────────────────
if (!pkg.scripts || !pkg.scripts['validate:persistence']) {
  fail('§7 package.json must define validate:persistence');
} else if (!fs.existsSync(path.join(ROOT, 'scripts/validate-persistence.mjs'))) {
  fail('§7 scripts/validate-persistence.mjs must exist');
} else {
  pass('§7 validate:persistence present');
}
if (!/criticalWritesPersisted/.test(persist)) {
  fail('§7 __persistenceHealth must surface criticalWritesPersisted');
}

// ─── 8. invite validation never fakes delivery ─────────────────
const inviteRt = read('src/runtime/invites/InviteRuntime.ts');
if (!/fakeDelivery:\s*false/.test(inviteRt)) {
  fail('§8 InviteRuntime must report fakeDelivery: false (no faked delivery)');
} else {
  pass('§8 invite validation never fakes delivery');
}
const pilotGap = read('src/runtime/pilotGap/PilotGapHealthRuntime.ts');
if (!/__inviteValidationHealth/.test(pilotGap)) {
  fail('§8 __inviteValidationHealth diagnostic missing');
}

// ─── 9. outcome-capture diagnostic present ─────────────────────
const pilotHealth = read('src/runtime/pilot/PilotHealthRuntime.ts');
for (const tok of ['scanCaptured', 'diagnosisCaptured', 'recommendationCaptured',
                   'taskCaptured', 'followUpScanCaptured', 'outcomeStatusCaptured']) {
  if (!new RegExp(`\\b${tok}\\b`).test(pilotHealth)) {
    fail(`§10 __outcomeCaptureHealth must surface "${tok}"`);
  }
}
if (!FAILED.some((f) => f.startsWith('§10'))) {
  pass('§10 outcome-capture diagnostic surfaces the full scan→outcome chain');
}

// ─── 10. the four validation diagnostics present + wired ───────
for (const g of ['__scanCameraUXHealth', '__uploadAnalysisHealth',
                 '__captureAnalysisHealth', '__inviteValidationHealth']) {
  if (!new RegExp(`\\b${g}\\b`).test(pilotGap)) {
    fail(`diag: PilotGapHealthRuntime must surface ${g}`);
  }
}
const app = read('src/App.jsx');
if (!/installPilotGapHealthGlobals/.test(app)) {
  fail('wiring: App.jsx must wire installPilotGapHealthGlobals');
}
const polling = read('src/runtime/polling/PollingHealthRuntime.ts');
if (!/translationCached/.test(polling)) {
  fail('§6 __pollingHealth must surface translationCached');
}
if (!FAILED.some((f) => f.startsWith('diag:') || f.startsWith('wiring:'))) {
  pass('diag: 4 validation diagnostics present + wired; __pollingHealth has translationCached');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:final-pilot-gap-fix] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:final-pilot-gap-fix] PASS — all ten pilot guarantees intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
