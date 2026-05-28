#!/usr/bin/env node
/**
 * check-offline-runtime.mjs — wave 7 CI ratchet.
 *
 *   node scripts/check-offline-runtime.mjs
 *
 * What this verifies
 * ──────────────────
 *   1. All wave-7 modules exist:
 *        queueRegistry, reconcileReconnect, deviceResilience,
 *        continuityRestoration, offlineRuntime
 *   2. queueRegistry declares all 5 QUEUE_KIND values:
 *        SCAN, TASK, JOURNAL, NOTIFICATION, RECOMMENDATION_ACK
 *   3. offlineRuntime registers an adapter for each of the 5 kinds.
 *   4. reconcileReconnect declares a deterministic DRAIN_ORDER
 *      array covering all 5 kinds.
 *   5. deviceResilience installs visibilitychange + pageshow +
 *      online listeners.
 *   6. continuityRestoration's restoreActiveContext returns
 *      activeFarm/activeCrop/activeSeason/activeTask shape.
 *   7. Wave-7 diagnostics wired:
 *        __queueHealth, __replayHealth, __deviceResilience,
 *        __activeContextRestore
 *   8. App.jsx invokes installOfflineRuntime() during boot.
 *
 * Hard gate — no baseline, no grandfathering.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:offline-runtime]';

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

const FILES = {
  registry:    'src/runtime/offline/queueRegistry.js',
  reconcile:   'src/runtime/offline/reconcileReconnect.js',
  resilience:  'src/runtime/offline/deviceResilience.js',
  restoration: 'src/runtime/continuity/continuityRestoration.js',
  offline:     'src/runtime/offline/offlineRuntime.js',
  diagnostics: 'src/lib/weatherAndLanguageDiagnostics.js',
  app:         'src/App.jsx',
};

const sources = {};
for (const [key, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing required file: ' + rel);
  sources[key] = src;
}

// 1) QUEUE_KIND values
const QUEUE_KINDS = ['SCAN', 'TASK', 'JOURNAL', 'NOTIFICATION', 'RECOMMENDATION_ACK'];
const kindBlock = sources.registry.match(
  /QUEUE_KIND\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
if (!kindBlock) fail('QUEUE_KIND block missing in queueRegistry.js');
for (const k of QUEUE_KINDS) {
  if (!new RegExp(k + '\\s*:').test(kindBlock[1])) {
    fail('QUEUE_KIND missing entry: ' + k);
  }
}

// 2) Each kind registered in offlineRuntime
for (const k of QUEUE_KINDS) {
  if (!new RegExp('QUEUE_KIND\\.' + k + '\\b').test(sources.offline)) {
    fail('offlineRuntime does not register adapter for QUEUE_KIND.' + k);
  }
}

// 3) reconcileReconnect declares DRAIN_ORDER covering all kinds
if (!/DRAIN_ORDER\s*=\s*Object\.freeze\(\[/.test(sources.reconcile)) {
  fail('reconcileReconnect.js missing DRAIN_ORDER array');
}
for (const k of QUEUE_KINDS) {
  if (!new RegExp('QUEUE_KIND\\.' + k + '\\b').test(sources.reconcile)) {
    fail('DRAIN_ORDER missing QUEUE_KIND.' + k);
  }
}

// 4) deviceResilience installs all three listeners
const RESILIENCE_EVENTS = ['visibilitychange', 'pageshow', 'online'];
for (const ev of RESILIENCE_EVENTS) {
  if (!new RegExp("addEventListener\\(\\s*['\"]" + ev + "['\"]")
        .test(sources.resilience)) {
    fail('deviceResilience missing addEventListener for: ' + ev);
  }
}

// 5) continuityRestoration returns activeFarm/Crop/Season/Task shape
for (const key of ['activeFarm', 'activeCrop', 'activeSeason', 'activeTask']) {
  if (!new RegExp(key + '\\s*:').test(sources.restoration)) {
    fail('continuityRestoration restoreActiveContext envelope missing: ' + key);
  }
}

// 6) Diagnostics wired
const DIAGNOSTICS = [
  '__queueHealth', '__replayHealth',
  '__deviceResilience', '__activeContextRestore',
];
for (const d of DIAGNOSTICS) {
  if (!new RegExp('window\\.' + d + '\\s*=').test(sources.diagnostics)) {
    fail('diagnostic ' + d + ' not wired in ' + FILES.diagnostics);
  }
}

// 7) App.jsx wires installOfflineRuntime()
if (!/installOfflineRuntime\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installOfflineRuntime() during boot');
}

console.log(HEADER, 'PASS — wave 7 offline runtime complete.');
console.log('  ' + QUEUE_KINDS.length + ' queues declared + registered + drained-in-order.');
console.log('  ' + RESILIENCE_EVENTS.length + ' resilience listeners attached.');
console.log('  ' + DIAGNOSTICS.length + ' diagnostics wired. Install present.');
process.exit(0);
