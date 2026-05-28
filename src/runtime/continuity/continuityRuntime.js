/**
 * continuityRuntime.js — Wave 5 RUNTIME continuity orchestrator.
 *
 *   import { installContinuityRuntime, getContinuityHealth }
 *     from 'src/runtime/continuity/continuityRuntime.js';
 *
 * What this is
 * ────────────
 *   The single bootstrap entry that wires the three wave-5 runtime
 *   pieces — persistence registry, sync orchestration, event log —
 *   into the app:
 *
 *     1. Registers the canonical writer for every known persistence
 *        domain (PERSISTENCE_DOMAIN → moduleId). This is the
 *        SOURCE OF TRUTH for "who owns writing X".
 *     2. Installs the sync orchestrator (reconnect drain).
 *     3. Subscribes the event runtime to existing bus channels so
 *        every published event is recorded for replay.
 *     4. Exposes a composite health snapshot for the diagnostic
 *        layer.
 *
 *   App.jsx calls `installContinuityRuntime()` once during mount.
 *   Subsequent calls no-op.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (no DOM access).
 *   • Idempotent install. Module state guards against double-wire.
 *   • Registry of writers is INFORMATIONAL — does not intercept
 *     write calls. Actual writes happen through the registered
 *     modules unchanged.
 *   • No PII; the registry stores moduleId strings only.
 */

import {
  registerWriter, getOwnershipMap, getWriter,
  PERSISTENCE_DOMAIN,
} from '../persistence/persistenceRuntime.js';
import {
  installSyncOrchestration, getSyncSnapshot,
} from '../sync/syncRuntime.js';
import {
  recordEvent, getEventIntegritySnapshot, EVENT_KIND,
} from '../events/eventRuntime.js';
import {
  subscribe as busSubscribe, FarmEvents,
} from '../../lib/farmEventBus.js';

const RUNTIME_VERSION = 'continuity-runtime-v1';

const _state = {
  installed:          false,
  busSubscriptions:   [],
  writersRegistered:  0,
  installedAt:        null,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

// ─── Writer registry ───────────────────────────────────────────
//
// Each entry names the canonical module that owns the write path
// for a given persistence domain. Wave 4 closed the import-path
// pluralism; wave 5 names the runtime ownership in one place so a
// future contributor (or a CI guard) can verify single-writer.

export const CANONICAL_WRITERS = Object.freeze([
  // Scan persistence — wave 0 bridge owns all four scan write paths.
  [PERSISTENCE_DOMAIN.SCAN_JOURNAL,
    'src/core/scan/scanPersistenceBridge.js#persistScanToJournal'],
  [PERSISTENCE_DOMAIN.SCAN_USEFUL,
    'src/core/scan/scanPersistenceBridge.js#persistScanUseful'],
  [PERSISTENCE_DOMAIN.SCAN_TASK_ADDED,
    'src/core/scan/scanPersistenceBridge.js#markScanTaskAdded'],
  [PERSISTENCE_DOMAIN.SCAN_FOLLOWUP_TASKS,
    'src/core/scan/scanPersistenceBridge.js#createScanFollowUpTasks'],
  [PERSISTENCE_DOMAIN.SCAN_OFFLINE_QUEUE,
    'src/core/scan/offlineScanQueue.js'],

  // Farm state — canonical Zustand store.
  [PERSISTENCE_DOMAIN.ACTIVE_FARM,
    'src/store/canonicalFarmStore.js'],
  [PERSISTENCE_DOMAIN.FARM_LIST,
    'src/store/canonicalFarmStore.js'],
  [PERSISTENCE_DOMAIN.FARM_LOCATION,
    'src/core/location/locationIntelligenceEngine.js'],

  // Intelligence memory.
  [PERSISTENCE_DOMAIN.RECOMMENDATION_LOG,
    'src/core/intelligence/recommendationLearning.js'],
  [PERSISTENCE_DOMAIN.OUTCOME_MEMORY,
    'src/core/memory/outcomeMemory.js'],
  [PERSISTENCE_DOMAIN.CONFIDENCE_LOG,
    'src/core/trust/confidenceLoopEngine.js'],

  // Notifications + tasks.
  [PERSISTENCE_DOMAIN.NOTIFICATION_HISTORY,
    'src/hooks/useFarmerNotificationsRuntime.js (server-backed)'],
  [PERSISTENCE_DOMAIN.TASK_HISTORY,
    'src/runtime/services/loadTasksSafe.js (server-backed)'],
  [PERSISTENCE_DOMAIN.TASK_TEMPORARY,
    'src/runtime/services/temporaryTasks.js'],

  // Telemetry / events.
  [PERSISTENCE_DOMAIN.EVENT_STORE,
    'src/core/eventStore.js'],
  [PERSISTENCE_DOMAIN.EVENT_LOG,
    'src/runtime/events/eventRuntime.js'],

  // Locale / app state.
  [PERSISTENCE_DOMAIN.LOCALE_BRIDGE,
    'src/i18n/localeStorageBridge.js'],
  [PERSISTENCE_DOMAIN.LANGUAGE_STORE,
    'src/store/languageStore.js'],

  // Offline mutations.
  [PERSISTENCE_DOMAIN.OFFLINE_MUTATIONS,
    'src/utils/offlineQueue.js'],

  // Marketplace.
  [PERSISTENCE_DOMAIN.MARKET_LISTINGS,
    'src/market/marketStore.js (via src/runtime/market/marketStore.js)'],
  [PERSISTENCE_DOMAIN.MARKET_BOOST,
    'src/market/boostStore.js (via src/runtime/market/boostStore.js)'],
  [PERSISTENCE_DOMAIN.MARKET_BUYER_INTERESTS,
    'src/market/buyerPreferences.js (via runtime/market/buyerPreferences.js)'],
]);

// ─── Event subscriptions ───────────────────────────────────────
//
// Mirror every bus event into the wave-5 event log. Existing
// subscribers continue to work; the log adds replay-safety on top.

function _wireEventMirror() {
  const eventsToMirror = [
    FarmEvents.SCAN_COMPLETED,
    FarmEvents.TASK_CREATED,
    FarmEvents.TASK_COMPLETED,
    FarmEvents.TASK_OVERDUE,
    FarmEvents.FARM_CREATED,
    FarmEvents.FARM_UPDATED,
    FarmEvents.LOCATION_UPDATED,
    FarmEvents.JOURNAL_ENTRY_CREATED,
  ];
  for (const ev of eventsToMirror) {
    if (typeof ev !== 'string') continue;
    const unsub = _safe(() =>
      busSubscribe(ev, (payload) => {
        // Bus subscribers receive the payload as-is.
        // We append it to the wave-5 log under the same kind.
        recordEvent(ev, payload || null);
      }),
    null);
    if (typeof unsub === 'function') _state.busSubscriptions.push(unsub);
  }
}

/**
 * Install the continuity runtime. Idempotent.
 * Called once from src/App.jsx mount effect.
 */
export function installContinuityRuntime() {
  if (_state.installed) {
    return Object.freeze({ ok: true, alreadyInstalled: true });
  }
  // 1) Register canonical writers.
  let registered = 0;
  for (const [domain, writerId] of CANONICAL_WRITERS) {
    const res = registerWriter(domain, writerId);
    if (res && res.ok) registered += 1;
  }
  _state.writersRegistered = registered;
  // 2) Install sync orchestration.
  _safe(() => installSyncOrchestration(), null);
  // 3) Wire event mirror — bus events flow into the wave-5 log.
  _wireEventMirror();
  _state.installed = true;
  _state.installedAt = _now();
  return Object.freeze({
    ok: true, writersRegistered: registered,
  });
}

/**
 * Composite continuity health snapshot. Drives __continuityHealth().
 */
export function getContinuityHealth() {
  const ownership = getOwnershipMap();
  const sync      = getSyncSnapshot();
  const events    = getEventIntegritySnapshot();
  const writersOk = ownership.healthy
    && ownership.registered === Object.values(PERSISTENCE_DOMAIN).length;
  const syncOk    = sync.installed && sync.reconcileListenerInstalled;
  const eventsOk  = events.healthy;
  return Object.freeze({
    runtimeVersion:   RUNTIME_VERSION,
    installed:        _state.installed,
    installedAt:      _state.installedAt,
    persistence: Object.freeze({
      ok:               writersOk,
      registered:       ownership.registered,
      totalDomains:     Object.values(PERSISTENCE_DOMAIN).length,
      coverage:         ownership.coverage,
      violations:       ownership.violations.length,
    }),
    sync: Object.freeze({
      ok:               syncOk,
      installed:        sync.installed,
      drainsTriggered:  sync.drainsTriggered,
      lastDrainOutcome: sync.lastDrainOutcome,
      lastReconnectAt:  sync.lastReconnectAt,
      scanQueueDepth:   sync.scanQueueDepth,
    }),
    events: Object.freeze({
      ok:               eventsOk,
      logSize:          events.logSize,
      capacity:         events.capacity,
      globalSeq:        events.globalSeq,
      monotonic:        events.monotonic,
      domainMonotonic:  events.domainMonotonic,
      domainsObserved:  events.domainsObserved,
    }),
    overall: Object.freeze({
      ok:         writersOk && syncOk && eventsOk,
      coverage:   ownership.coverage,
    }),
  });
}

/**
 * Read-only diagnostic showing the writer registry.
 */
export function getStateOwnershipReport() {
  const ownership = getOwnershipMap();
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    coverage:       ownership.coverage,
    coveragePct:    Math.round(ownership.coverage * 100),
    registered:     ownership.registered,
    totalDomains:   Object.values(PERSISTENCE_DOMAIN).length,
    owners:         ownership.owners,
    violations:     ownership.violations,
    healthy:        ownership.healthy,
  });
}

export function _resetForTests() {
  for (const unsub of _state.busSubscriptions) _safe(unsub, null);
  _state.busSubscriptions.length = 0;
  _state.installed = false;
  _state.writersRegistered = 0;
  _state.installedAt = null;
}

const _module = {
  installContinuityRuntime, getContinuityHealth,
  getStateOwnershipReport,
  CANONICAL_WRITERS, _resetForTests,
};
export default _module;
