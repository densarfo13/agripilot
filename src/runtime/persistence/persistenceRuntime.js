/**
 * persistenceRuntime.js — Wave 5 RUNTIME governance.
 *
 *   import {
 *     registerWriter, getWriter, getOwnershipMap, enforceSingleWriter,
 *     PERSISTENCE_DOMAIN,
 *   } from 'src/runtime/persistence/persistenceRuntime.js';
 *
 * What this is
 * ────────────
 *   A single registry that records WHICH MODULE owns the canonical
 *   write path for each persistence domain. After wave 4 every UI
 *   surface routes through the runtime layer; wave 5 names — at the
 *   module level — which runtime module owns each domain so a
 *   future contributor can find the One True Writer without
 *   archaeological grep.
 *
 *   The registry is INFORMATIONAL + ENFORCING:
 *     • registerWriter(domain, writerId) — sets the owner
 *     • duplicate registration with a different writerId fails
 *       (the second caller learns it is bypassing the canonical
 *       owner)
 *     • getOwnershipMap() snapshot drives the live diagnostic
 *       window.__stateOwnership() so QA can verify ownership in
 *       DevTools without re-reading source
 *
 *   The registry does NOT proxy writes — actual persistence still
 *   happens through the registered modules directly. The registry's
 *   purpose is to make the invariant explicit and inspectable.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws on inspect — only on duplicate
 *     register (which is by design; that's the enforcement gate).
 *   • SSR-safe. The registry is module-level; works the same in
 *     node and browser.
 *   • No PII. The registry stores moduleId strings, not data.
 */

const RUNTIME_VERSION = 'persistence-runtime-v1';

/**
 * Canonical persistence domains. Add new domains here as the
 * codebase grows so the registry stays exhaustive.
 */
export const PERSISTENCE_DOMAIN = Object.freeze({
  // Scan lifecycle
  SCAN_JOURNAL:        'scan.journal',
  SCAN_USEFUL:         'scan.useful',
  SCAN_TASK_ADDED:     'scan.task_added',
  SCAN_FOLLOWUP_TASKS: 'scan.followup_tasks',
  SCAN_OFFLINE_QUEUE:  'scan.offline_queue',
  // Farm lifecycle
  ACTIVE_FARM:         'farm.active',
  FARM_LIST:           'farm.list',
  FARM_LOCATION:       'farm.location',
  // Recommendations / intelligence
  RECOMMENDATION_LOG:  'recommendation.log',
  OUTCOME_MEMORY:      'outcome.memory',
  CONFIDENCE_LOG:      'confidence.log',
  // Notifications + tasks
  NOTIFICATION_HISTORY: 'notification.history',
  TASK_HISTORY:        'task.history',
  TASK_TEMPORARY:      'task.temporary',
  // Telemetry / events
  EVENT_STORE:         'event.store',
  EVENT_LOG:           'event.log',
  // Locale / app state
  LOCALE_BRIDGE:       'app.locale_bridge',
  LANGUAGE_STORE:      'app.language_store',
  // Offline queue + sync
  OFFLINE_MUTATIONS:   'sync.offline_mutations',
  // Marketplace
  MARKET_LISTINGS:     'market.listings',
  MARKET_BOOST:        'market.boost',
  MARKET_BUYER_INTERESTS: 'market.buyer_interests',
});

const _registry = new Map();
const _registeredAt = new Map();
const _violations = [];

const _now = () => {
  try { return new Date().toISOString(); } catch { return ''; }
};

/**
 * Register the canonical writer module for a domain.
 *
 *   @param {string} domain   — one of PERSISTENCE_DOMAIN values
 *   @param {string} writerId — module identifier (path or symbolic name)
 *   @returns {{ ok, reason? }}
 */
export function registerWriter(domain, writerId) {
  if (typeof domain !== 'string' || !domain) {
    return Object.freeze({ ok: false, reason: 'invalid_domain' });
  }
  if (typeof writerId !== 'string' || !writerId) {
    return Object.freeze({ ok: false, reason: 'invalid_writer_id' });
  }
  const existing = _registry.get(domain);
  if (existing && existing !== writerId) {
    // Duplicate-writer violation — record it so the diagnostic
    // surfaces it, but do NOT throw (so a misconfigured boot
    // doesn't crash the app). The diagnostic + tests catch it.
    _violations.push(Object.freeze({
      domain, attemptedWriterId: writerId,
      existingWriterId: existing, at: _now(),
    }));
    return Object.freeze({
      ok: false, reason: 'duplicate_writer',
      existingWriterId: existing,
    });
  }
  if (!existing) {
    _registry.set(domain, writerId);
    _registeredAt.set(domain, _now());
  }
  return Object.freeze({ ok: true });
}

/**
 * Look up the canonical writer for a domain.
 */
export function getWriter(domain) {
  return _registry.get(domain) || null;
}

/**
 * Inspect the full ownership map. Returns a frozen object keyed by
 * domain → writerId, plus a violations list (empty when healthy).
 */
export function getOwnershipMap() {
  const owners = {};
  for (const [domain, writerId] of _registry.entries()) {
    owners[domain] = Object.freeze({
      writerId,
      registeredAt: _registeredAt.get(domain) || null,
    });
  }
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    domains:        Object.values(PERSISTENCE_DOMAIN).length,
    registered:     _registry.size,
    coverage:       _registry.size / Object.values(PERSISTENCE_DOMAIN).length,
    owners:         Object.freeze(owners),
    violations:     Object.freeze(_violations.slice()),
    healthy:        _violations.length === 0,
  });
}

/**
 * Enforce-style introspection. Returns `{ok}` indicating whether
 * the domain has a single registered writer. Used by tests + the
 * continuity health diagnostic.
 */
export function enforceSingleWriter(domain) {
  const existing = _registry.get(domain);
  if (!existing) {
    return Object.freeze({
      ok: false, reason: 'no_writer_registered', domain,
    });
  }
  const conflicts = _violations.filter((v) => v.domain === domain);
  if (conflicts.length > 0) {
    return Object.freeze({
      ok: false, reason: 'duplicate_writer_seen',
      domain, conflicts: Object.freeze(conflicts),
    });
  }
  return Object.freeze({ ok: true, domain, writerId: existing });
}

export function _resetForTests() {
  _registry.clear();
  _registeredAt.clear();
  _violations.length = 0;
}

const _module = {
  PERSISTENCE_DOMAIN,
  registerWriter, getWriter, getOwnershipMap, enforceSingleWriter,
  _resetForTests,
};
export default _module;
