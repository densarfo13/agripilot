#!/usr/bin/env node
/**
 * scripts/check-no-429-polling-loop.mjs — perf gate.
 * Fails if a 429 polling loop can reappear:
 *   • /api/health not throttled to ≥60s
 *   • translations not cached / no backoff
 *   • auth refresh has no 429 backoff
 *   • UI pollers don't pause on a hidden tab
 *   • __pollingPerformanceHealth diagnostic missing
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const persist = read('src/runtime/persistence/PersistenceHealth.ts');
if (!/HEALTH_POLL_MIN_MS/.test(persist) || !/_HEALTH_THROTTLE_MS\s*=\s*60_?000/.test(persist))
  F.push('/api/health must throttle to ≥60s (HEALTH_POLL_MIN_MS)'); else P.push('health ≥60s throttle');

const i18n = read('src/utils/i18n.js');
if (!/_i18nCache/.test(i18n) || !/_i18nBackoffUntil/.test(i18n))
  F.push('translations must cache + back off after 429'); else P.push('translations cached + backoff');

const api = read('src/lib/api.js');
if (!/_enterDegraded/.test(api) || !/_DEGRADED_BACKOFF_MS/.test(api))
  F.push('auth refresh must have 429/5xx degraded-mode backoff'); else P.push('auth refresh backoff');

// UI pollers must pause when the tab is hidden.
for (const f of ['src/components/scan/ScanHub.jsx',
                 'src/components/system/OfflineQueueBanner.jsx',
                 'src/components/scan/ScanStartupBanner.jsx']) {
  const src = read(f);
  if (/setInterval|setTimeout\(tick/.test(src) && !/document\.hidden/.test(src))
    F.push(`${f}: poller must skip work while document.hidden`);
}
if (!F.some((m) => m.includes('document.hidden'))) P.push('UI pollers pause on hidden tab');

const perf = read('src/runtime/performance/PerformanceHealthRuntime.ts');
if (!/__pollingPerformanceHealth/.test(perf)) F.push('__pollingPerformanceHealth diagnostic missing');
else P.push('__pollingPerformanceHealth present');

if (F.length) { console.error('[check:no-429-polling-loop] FAIL'); F.forEach((m)=>console.error('  ✗ '+m)); process.exit(1); }
console.log('[check:no-429-polling-loop] PASS — health throttled, translations cached, auth backoff, pollers pause hidden.');
P.forEach((m)=>console.log('  ✓ '+m));
