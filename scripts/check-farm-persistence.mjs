/**
 * check-farm-persistence.mjs — FARM_PERSISTENCE_V1.
 * Locks the durable persistence layer: server table + sync/recover API,
 * the client sync engine (write-through mirror + offline queue + recover),
 * and the mirror+hydrator wiring for all FIVE domains. Postgres is the
 * source of truth; localStorage is only a cache.
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };
const DOMAINS = ['plants', 'scanHistory', 'tasks', 'outcomes', 'timeline'];

// Schema + migration.
const SCHEMA = rd('server/prisma/schema.prisma');
h(SCHEMA, 'model FarmStateRecord', 'schema must define FarmStateRecord');
h(SCHEMA, '@@unique([userId, domain, recordId]', 'must be unique per (user, domain, record)');
const MIG = 'server/prisma/migrations/20260624010000_farm_persistence/migration.sql';
if (!x(MIG)) E.push('missing migration: ' + MIG);
else h(rd(MIG), 'CREATE TABLE IF NOT EXISTS "farm_state_records"', 'migration must create the table');

// Server service + endpoints.
const SVC = 'server/src/services/farmStateService.js';
if (!x(SVC)) E.push('missing: ' + SVC); else { const s = rd(SVC);
  h(s, 'export async function syncRecords', 'must export syncRecords');
  h(s, 'export async function getRecords', 'must export getRecords');
  for (const d of DOMAINS) h(s, "'" + d + "'", 'service must whitelist domain: ' + d);
  h(s, 'clientUpdatedAt', 'must support last-write-wins by clientUpdatedAt');
}
const APP = rd('server/src/app.js');
h(APP, "'/api/farm-state/sync'", 'must mount POST /api/farm-state/sync');
h(APP, "'/api/farm-state'", 'must mount GET /api/farm-state');

// Client sync engine.
const FS = 'src/lib/sync/farmSync.js';
if (!x(FS)) E.push('missing: ' + FS); else { const s = rd(FS);
  for (const fn of ['mirror', 'flush', 'recoverAll', 'registerHydrator', 'installFarmSync']) {
    if (!s.includes('export function ' + fn) && !s.includes('export async function ' + fn))
      E.push('farmSync must export ' + fn);
  }
  h(s, 'farroway_farm_sync_queue', 'must use a localStorage offline queue');
  h(s, "addEventListener('online'", 'must drain the queue on reconnect');
  h(s, '__farmSyncHealth', 'must install __farmSyncHealth');
  h(s, "sourceOfTruth: 'postgres'", 'health must declare postgres as source of truth');
  h(s, "localStorageRole: 'cache'", 'health must declare localStorage as cache only');
}

// Mirror call sites + hydrators (all five domains).
const WIRES = [
  ['src/data/managedPlantsStore.js', 'hydrateManagedPlants', "mirror('plants'"],
  ['src/lib/scan/scanHistoryStore.js', 'hydrateScanHistory', "mirror('scanHistory'"],
  ['src/core/scanToTask.js', 'hydrateScanTasks', "mirror('tasks'"],
  ['src/lib/outcomes/outcomeStore.js', 'hydrateOutcomes', "mirror('outcomes'"],
  ['src/lib/plant/timelineStore.js', 'hydrateTimeline', "mirror('timeline'"],
];
for (const [file, hydrator, mirrorCall] of WIRES) {
  const s = rd(file);
  if (!s) { E.push('missing: ' + file); continue; }
  h(s, 'export function ' + hydrator, file + ' must export ' + hydrator);
  h(s, mirrorCall, file + ' must mirror writes: ' + mirrorCall);
}

// Boot + recover-on-login.
const BOOT = 'src/runtime/sync/farmPersistenceBoot.js';
if (!x(BOOT)) E.push('missing: ' + BOOT); else { const s = rd(BOOT);
  h(s, 'export async function bootFarmPersistence', 'must export bootFarmPersistence');
  for (const d of DOMAINS) h(s, "registerHydrator('" + d + "'", 'boot must register hydrator: ' + d);
}
h(rd('src/context/AuthContext.jsx'), 'bootFarmPersistence', 'AuthContext must recover farm state on login');

if (E.length) { console.error('[check:farm-persistence] FAIL — ' + E.length + ' issue(s):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:farm-persistence] PASS — durable table + sync/recover API; write-through mirror + offline queue + recover-on-login wired for all 5 domains; postgres=source of truth, localStorage=cache.');
