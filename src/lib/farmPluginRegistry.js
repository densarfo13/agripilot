/**
 * farmPluginRegistry.js — concrete plugin contract for §10.
 *
 *   registerPlugin({
 *     name:     'satellite_intelligence',
 *     version:  '0.1.0',
 *     provides: ['satellite_snapshot'],
 *     subscribes: {
 *       [FarmEvents.SCAN_COMPLETED]: (payload) => { ... },
 *     },
 *     init:    async (ctx) => { ... },     // optional, lazy
 *     teardown: async () => { ... },       // optional
 *   });
 *
 *   await initializePlugins();
 *   const sat = getProvider('satellite_snapshot');
 *
 * What the contract guarantees
 * ────────────────────────────
 *   1. NAME + VERSION         — required. Used as plugin id and for
 *                                migration / compat checks.
 *   2. PROVIDES (capabilities) — optional list of capability strings.
 *                                getProvider(capability) returns the
 *                                FIRST plugin that provides it (FIFO).
 *   3. SUBSCRIBES              — map of FarmEvent → handler. The
 *                                registry auto-wires handlers via
 *                                farmEventBus.subscribe() during
 *                                init(); teardown unsubscribes.
 *                                Handlers run inside runIsolated so
 *                                a buggy plugin can never crash bus
 *                                publishers.
 *   4. INIT (async, optional)  — called once at initializePlugins().
 *                                Failures are recorded but never
 *                                throw. The plugin stays registered
 *                                in 'init_failed' state for diagnostics.
 *   5. TEARDOWN (async)        — called on teardownPlugins() (sign-out
 *                                or test reset). Auto-unsubscribes
 *                                event handlers.
 *
 * Future plugins (per spec §10)
 * ─────────────────────────────
 *   • satellite intelligence    — provides('satellite_snapshot')
 *                                  consumes(SCAN_COMPLETED, FARM_UPDATED)
 *   • drone imagery              — provides('drone_imagery')
 *   • IoT sensors                — provides('soil_moisture', etc.)
 *                                  publishes(SOIL_UPDATED, IRRIGATION_RISK)
 *   • marketplace                — provides('market_prices')
 *                                  publishes(MARKET_UPDATED, HARVEST_READY)
 *   • financing                  — provides('credit_score')
 *                                  consumes(HARVEST_READY)
 *   • insurance scoring          — provides('insurance_quote')
 *                                  consumes(DISEASE_DETECTED, OUTBREAK_DETECTED)
 *
 *   Today, NO plugins ship in this commit. We ship the contract;
 *   each capability is its own product-decision spec round.
 *
 * Strict-rule audit
 *   • Pure registry: registration is sync + side-effect-free until
 *     initializePlugins() is called explicitly.
 *   • Plugin event handlers wrapped via runIsolated — a buggy
 *     plugin handler cannot crash the bus or sibling plugins.
 *   • Errors recorded per-plugin in `pluginStatus[name].errors` so
 *     a future debug panel can surface "which plugin is failing."
 */

import { subscribe as busSubscribe, FarmEvents, isKnownEvent } from './farmEventBus.js';
import { runIsolated, runIsolatedAsync } from './subsystemIsolator.js';
import { trackCount, trackError } from './farmTelemetry.js';

export const PLUGIN_STATE = Object.freeze({
  REGISTERED:    'registered',     // registered but not yet init()'d
  INITIALIZING:  'initializing',
  ACTIVE:        'active',
  INIT_FAILED:   'init_failed',
  TORN_DOWN:     'torn_down',
});

// ─── Internal state ───────────────────────────────────────────

const _plugins = new Map();       // name -> { manifest, state, unsubs, errors }
const _providers = new Map();     // capability -> first plugin name registered

// ─── Helpers ──────────────────────────────────────────────────

function _safeStr(v) {
  return (typeof v === 'string' && v) ? v : null;
}

function _validateManifest(m) {
  if (!m || typeof m !== 'object') return 'manifest_not_object';
  if (!_safeStr(m.name))    return 'name_required';
  if (!_safeStr(m.version)) return 'version_required';
  if (m.subscribes && typeof m.subscribes !== 'object') return 'subscribes_not_object';
  if (m.init     && typeof m.init     !== 'function')   return 'init_not_function';
  if (m.teardown && typeof m.teardown !== 'function')   return 'teardown_not_function';
  if (m.provides && !Array.isArray(m.provides))         return 'provides_not_array';
  return null;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Register a plugin manifest. Returns { ok, reason } so callers
 * can decide whether to surface an error vs. swallow.
 *
 * @param {object} manifest
 * @returns {{ ok: boolean, reason?: string }}
 */
export function registerPlugin(manifest) {
  const reason = _validateManifest(manifest);
  if (reason) return { ok: false, reason };
  if (_plugins.has(manifest.name)) {
    return { ok: false, reason: 'duplicate_name' };
  }
  _plugins.set(manifest.name, {
    manifest,
    state:  PLUGIN_STATE.REGISTERED,
    unsubs: [],
    errors: [],
  });
  // Register provided capabilities — FIFO winner; later plugins
  // claiming the same capability are noted but don't displace.
  if (Array.isArray(manifest.provides)) {
    for (const cap of manifest.provides) {
      const capName = _safeStr(cap);
      if (!capName) continue;
      if (!_providers.has(capName)) _providers.set(capName, manifest.name);
    }
  }
  trackCount('plugin.registered');
  return { ok: true };
}

/**
 * Look up a plugin by name. Returns null when not registered.
 */
export function getPlugin(name) {
  const n = _safeStr(name);
  if (!n) return null;
  const entry = _plugins.get(n);
  if (!entry) return null;
  return {
    name:    entry.manifest.name,
    version: entry.manifest.version,
    state:   entry.state,
    provides: Array.isArray(entry.manifest.provides) ? entry.manifest.provides.slice() : [],
    errors:  entry.errors.slice(),
  };
}

/**
 * Look up the plugin that provides a capability. Returns null when
 * no plugin claims it.
 */
export function getProvider(capability) {
  const cap = _safeStr(capability);
  if (!cap) return null;
  const name = _providers.get(cap);
  if (!name) return null;
  return getPlugin(name);
}

/**
 * Initialize all REGISTERED plugins:
 *   1. wire up declared event subscriptions
 *   2. call init() under runIsolatedAsync
 * Returns a summary { ok, failed } so callers can log.
 *
 * Re-running this is safe — already-active plugins are skipped.
 */
export async function initializePlugins(ctx) {
  const ok = [];
  const failed = [];
  for (const [name, entry] of _plugins.entries()) {
    if (entry.state === PLUGIN_STATE.ACTIVE) {
      ok.push(name);
      continue;
    }
    entry.state = PLUGIN_STATE.INITIALIZING;

    // ── Auto-wire event subscriptions ─────────────────────
    try {
      const subs = entry.manifest.subscribes;
      if (subs && typeof subs === 'object') {
        for (const event of Object.keys(subs)) {
          if (!isKnownEvent(event) && event !== '*') {
            entry.errors.push({ ts: Date.now(), source: 'subscribe', message: 'unknown_event:' + event });
            continue;
          }
          const handler = subs[event];
          if (typeof handler !== 'function') continue;
          const isolatedHandler = (payload, meta) => {
            runIsolated('plugin.' + name + '.' + event, () => handler(payload, meta), null, {
              onError: (err) => {
                entry.errors.push({ ts: Date.now(), source: event, message: String((err && err.message) || err) });
              },
            });
          };
          entry.unsubs.push(busSubscribe(event, isolatedHandler));
        }
      }
    } catch (err) {
      entry.errors.push({ ts: Date.now(), source: 'subscribe_setup', message: String((err && err.message) || err) });
    }

    // ── Run init() under isolation ────────────────────────
    if (typeof entry.manifest.init === 'function') {
      const result = await runIsolatedAsync(
        'plugin.' + name + '.init',
        () => entry.manifest.init(ctx || {}),
        '__INIT_FAILED__',
        { onError: (err) => {
            entry.errors.push({ ts: Date.now(), source: 'init', message: String((err && err.message) || err) });
            trackError('plugin.' + name, err);
        }},
      );
      if (result === '__INIT_FAILED__') {
        entry.state = PLUGIN_STATE.INIT_FAILED;
        failed.push({ name, errors: entry.errors.slice() });
        trackCount('plugin.init_failed');
        continue;
      }
    }

    entry.state = PLUGIN_STATE.ACTIVE;
    ok.push(name);
    trackCount('plugin.active');
  }
  return { ok, failed };
}

/**
 * Tear down all active plugins. Unsubscribes their handlers and
 * runs each teardown() under isolation. Safe to call multiple times.
 */
export async function teardownPlugins() {
  for (const [name, entry] of _plugins.entries()) {
    if (entry.state === PLUGIN_STATE.TORN_DOWN) continue;
    // Unsubscribe declared handlers first so events stop flowing
    // before teardown does its work.
    for (const u of entry.unsubs) {
      try { u(); } catch { /* swallow */ }
    }
    entry.unsubs.length = 0;
    if (typeof entry.manifest.teardown === 'function') {
      await runIsolatedAsync(
        'plugin.' + name + '.teardown',
        () => entry.manifest.teardown(),
        null,
        { onError: (err) => {
            entry.errors.push({ ts: Date.now(), source: 'teardown', message: String((err && err.message) || err) });
        }},
      );
    }
    entry.state = PLUGIN_STATE.TORN_DOWN;
  }
}

/**
 * Read-only registry diagnostics for a debug overlay.
 *
 * @returns {{
 *   count:      number,
 *   plugins:    Array<{ name, version, state, provides, errorCount }>,
 *   providers:  Record<string, string>,
 * }}
 */
export function pluginDiagnostics() {
  const plugins = [];
  for (const [, entry] of _plugins.entries()) {
    plugins.push({
      name:      entry.manifest.name,
      version:   entry.manifest.version,
      state:     entry.state,
      provides:  Array.isArray(entry.manifest.provides) ? entry.manifest.provides.slice() : [],
      errorCount: entry.errors.length,
    });
  }
  const providers = {};
  for (const [cap, name] of _providers.entries()) providers[cap] = name;
  return { count: _plugins.size, plugins, providers };
}

/** Test helper / sign-out wipe. */
export function _resetRegistry() {
  for (const entry of _plugins.values()) {
    for (const u of entry.unsubs) { try { u(); } catch { /* swallow */ } }
  }
  _plugins.clear();
  _providers.clear();
}

export default {
  registerPlugin,
  getPlugin,
  getProvider,
  initializePlugins,
  teardownPlugins,
  pluginDiagnostics,
  _resetRegistry,
  PLUGIN_STATE,
  FarmEvents,
};
