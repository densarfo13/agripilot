/**
 * locationFlowState.test.js — the Home location-flow view-state. Self-running:
 * `tsx locationFlowState.test.js`. Proves the farmer always gets a loading signal
 * while detecting and a fallback (never stuck) when location is denied/unavailable.
 */
import { locationFlowView, shouldIgnoreLocationTap, LOCATION_STATUS } from '../locationFlowState.js';

let passed = 0;
function ok(c, m) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// Detecting → loading signal.
const d = locationFlowView(LOCATION_STATUS.DETECTING);
ok(d.mode === 'loading' && d.showLoading && !d.showFallback, 'detecting → loading');

// Denied / unavailable / error → fallback (the anti-stuck path).
for (const s of [LOCATION_STATUS.DENIED, 'unavailable', 'error']) {
  const v = locationFlowView(s);
  ok(v.mode === 'fallback' && v.showFallback && !v.showLoading, s + ' → fallback');
}

// Idle / dismissed / success / unknown → nothing shown.
for (const s of [LOCATION_STATUS.IDLE, LOCATION_STATUS.DISMISSED, 'success', '', null, undefined]) {
  const v = locationFlowView(s);
  ok(v.mode === 'hidden' && !v.showLoading && !v.showFallback, String(s) + ' → hidden');
}

// Re-tap guard: ignore a fresh tap only while detecting.
ok(shouldIgnoreLocationTap(LOCATION_STATUS.DETECTING) === true, 'detecting → ignore re-tap');
ok(shouldIgnoreLocationTap(LOCATION_STATUS.IDLE) === false, 'idle → allow tap');
ok(shouldIgnoreLocationTap(LOCATION_STATUS.DENIED) === false, 'denied → allow retry tap');

console.log('[test:location-flow] PASS — ' + passed + ' assertions (loading while detecting; fallback on denied/unavailable so the farmer is never stuck; hidden otherwise).');
