/**
 * check-notification-dedup.mjs — sprint #212 §11.
 * Fails build if the notification deduper is missing keys, the count
 * collapse, the health global, or the wiring into the bell render.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const D = _read('src/runtime/notifications/NotificationDeduper.ts');
if (!D) errors.push('missing NotificationDeduper.ts');
else {
  _has(D, 'export function dedupeNotifications', 'must export dedupeNotifications');
  for (const k of ['titleKey', 'type', 'relatedEntityId', 'createdDay']) {
    _has(D, k, 'deduper must key on: ' + k);
  }
  _has(D, 'duplicateCount', 'must collapse duplicates into a count');
  _has(D, '__notificationDedupHealth', 'must pin __notificationDedupHealth');
}
_has(_read('src/components/NotificationCenter.jsx'), 'dedupeNotifications',
  'NotificationCenter must dedupe before render');
_has(_read('src/App.jsx'), 'installNotificationDedupHealthGlobal',
  'App.jsx must boot-install notification dedup health');

if (errors.length) { console.error('[check:notification-dedup] FAIL'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('[check:notification-dedup] PASS — deduper keyed + collapse + wired + health.');
