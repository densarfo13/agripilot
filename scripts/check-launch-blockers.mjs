#!/usr/bin/env node
/**
 * scripts/check-launch-blockers.mjs — Wave-26 CI gate.
 *
 * Statically enforces the six wave-26 launch-blocker fixes (C-1…C-6)
 * + the composite go-live verdict are wired:
 *
 *   • src/runtime/launchBlockers/index.ts exports
 *     installLaunchBlockerGlobals
 *   • Six health runtimes exist and export their installers
 *   • App.jsx calls installLaunchBlockerGlobals during boot
 *   • Home.jsx handleMarkDone bridges into completeTask (C-2)
 *   • FarmerProgressPage.jsx no longer reads 'farroway_event_log'
 *     directly (C-3) — must use getCanonicalActivityEvents
 *   • ScanPage.jsx gates IntelligentScanResult behind
 *     shouldRenderIntelligentResult (C-4)
 *   • SyncStatus.jsx no longer references undefined `api` (C-6)
 *   • ProfileGuard.jsx wires isOnboardingValid into the route
 *     allowlist (C-1)
 *
 * Strict-rule audit
 *   • Read-only. Never mutates source.
 *   • Returns exit 1 with actionable messages on failure.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return ''; }
}

// ─── 1. Runtime suite exists ──────────────────────────────────
const SUITE = [
  ['OnboardingGuardRuntime.ts', 'installOnboardingGuardGlobal'],
  ['TaskStoreHealthRuntime.ts', 'installTaskStoreHealthGlobal'],
  ['ActivityDataHealthRuntime.ts', 'installActivityDataHealthGlobal'],
  ['ScanResultHealthRuntime.ts', 'installScanResultHealthGlobal'],
  ['ScanCtaHealthRuntime.ts', 'installScanCtaHealthGlobal'],
  ['SyncHealthRuntime.ts', 'installSyncHealthGlobal'],
  ['GoLiveHealthRuntime.ts', 'installGoLiveHealthGlobal'],
];
for (const [file, sym] of SUITE) {
  const p = path.join(ROOT, 'src/runtime/launchBlockers', file);
  const src = read(p);
  if (!src) { fail(`launch-blockers: missing ${file}`); continue; }
  if (!src.includes('export function ' + sym)) {
    fail(`launch-blockers: ${file} must export ${sym}`);
  }
}

const barrel = read(path.join(ROOT, 'src/runtime/launchBlockers/index.ts'));
for (const sym of ['installLaunchBlockerGlobals',
                    'isOnboardingValid',
                    'getCanonicalActivityEvents',
                    'shouldRenderIntelligentResult',
                    'goLiveHealth']) {
  if (!barrel.includes(sym)) {
    fail(`launch-blockers/index.ts must re-export ${sym}`);
  }
}
if (FAILED.length === 0) pass('launch-blockers: suite + barrel present');

// ─── 2. App.jsx boot install ──────────────────────────────────
const app = read(path.join(ROOT, 'src/App.jsx'));
if (!app.includes('installLaunchBlockerGlobals')) {
  fail(`App.jsx must call installLaunchBlockerGlobals() at boot`);
} else {
  pass('App.jsx boot wires installLaunchBlockerGlobals');
}

// ─── 3. C-1 ProfileGuard wires isOnboardingValid ──────────────
const profileGuard = read(path.join(ROOT, 'src/components/ProfileGuard.jsx'));
if (!profileGuard.includes('isOnboardingValid')) {
  fail(`C-1: ProfileGuard.jsx must import isOnboardingValid`);
} else if (!profileGuard.includes('/onboarding/fast')) {
  fail(`C-1: ProfileGuard.jsx must redirect to /onboarding/fast`);
} else {
  pass('C-1: ProfileGuard wires onboarding guard');
}

// ─── 4. C-2 Home.jsx bridges into completeTask ────────────────
const home = read(path.join(ROOT, 'src/pages/Home.jsx'));
const handleMarkDoneIdx = home.indexOf('function handleMarkDone');
if (handleMarkDoneIdx === -1) {
  fail('C-2: Home.jsx must define handleMarkDone');
} else {
  // Slice through the next ~80 lines to scope the assertion.
  const slice = home.slice(handleMarkDoneIdx, handleMarkDoneIdx + 4000);
  if (!slice.includes('completeTask')) {
    fail(`C-2: Home.jsx handleMarkDone must bridge into completeTask`);
  } else {
    pass('C-2: Home handleMarkDone bridges into completeTask');
  }
}

// ─── 5. C-3 FarmerProgressPage uses canonical helper ──────────
const progress = read(path.join(ROOT, 'src/pages/FarmerProgressPage.jsx'));
if (!progress.includes('getCanonicalActivityEvents')) {
  fail(`C-3: FarmerProgressPage.jsx must import getCanonicalActivityEvents`);
} else if (/getItem\(['"]farroway_event_log['"]/.test(progress)) {
  fail(`C-3: FarmerProgressPage.jsx must NOT read 'farroway_event_log' directly`);
} else {
  pass('C-3: FarmerProgressPage uses canonical activity events helper');
}

// ─── 6. C-4 ScanPage gates IntelligentScanResult ──────────────
const scan = read(path.join(ROOT, 'src/pages/ScanPage.jsx'));
if (!scan.includes('shouldRenderIntelligentResult')) {
  fail(`C-4: ScanPage.jsx must import shouldRenderIntelligentResult`);
} else {
  // Must appear in BOTH branches of the result render.
  const intelligentCalls = scan.match(/shouldRenderIntelligentResult\(\)/g) || [];
  if (intelligentCalls.length < 2) {
    fail(`C-4: ScanPage.jsx must call shouldRenderIntelligentResult() in BOTH result branches`);
  } else {
    pass('C-4: ScanPage gates IntelligentScanResult');
  }
}

// ─── 7. C-6 SyncStatus no longer references undefined `api` ───
const sync = read(path.join(ROOT, 'src/components/SyncStatus.jsx'));
if (/syncAll\(\s*api\s*\)/.test(sync)) {
  fail(`C-6: SyncStatus.jsx still references undefined 'api'`);
} else if (!sync.includes('apiRuntime')) {
  fail(`C-6: SyncStatus.jsx must import apiRuntime`);
} else {
  pass('C-6: SyncStatus ReferenceError removed');
}

// ─── 8. Release lock + go-live composite are reachable ────────
if (!barrel.includes('installGoLiveHealthGlobal')) {
  fail('go-live: barrel must re-export installGoLiveHealthGlobal');
} else {
  pass('go-live: composite verdict probe re-exported');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:launch-blockers] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:launch-blockers] PASS — six wave-26 critical blockers wired.');
console.log(`  C-1 onboarding guard          (ProfileGuard.jsx + OnboardingGuardRuntime)`);
console.log(`  C-2 task store bridge         (Home.jsx → completeTask)`);
console.log(`  C-3 activity canonical key    (FarmerProgressPage.jsx + ActivityDataHealthRuntime)`);
console.log(`  C-4 single scan result card   (ScanPage.jsx + ScanResultHealthRuntime)`);
console.log(`  C-5 scan CTA wiring probe     (ScanCtaHealthRuntime)`);
console.log(`  C-6 sync ReferenceError fix   (SyncStatus.jsx + SyncHealthRuntime)`);
console.log(`  + composite __goLiveHealth()  (GoLiveHealthRuntime)`);
