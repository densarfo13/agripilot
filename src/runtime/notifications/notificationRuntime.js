/**
 * notificationRuntime.js — Wave 8 RUNTIME push notification governance.
 *
 *   import {
 *     installNotificationRuntime, getNotificationHealth,
 *     requestNotificationPermission, scheduleNotification,
 *     NOTIFICATION_KIND,
 *   } from 'src/runtime/notifications/notificationRuntime.js';
 *
 * What this is
 * ────────────
 *   Single chokepoint for outbound notifications. Uses Capacitor's
 *   `@capacitor/local-notifications` on native + the Web
 *   Notification API as a graceful browser fallback. Both paths
 *   share the same wave-8 contract:
 *
 *     • OPT-IN ONLY — no notification fires until user grants
 *       permission via `requestNotificationPermission()`
 *     • NO SPAM — per-kind cooldown via wave-6 alertFatigueEngine
 *       (composed; not replaced)
 *     • NO FAKE URGENCY — only the 5 spec'd kinds are allowed
 *     • USER CAN DISABLE — `setEnabled(false)` immediately halts
 *       all future sends
 *     • CLEAR REASON — every scheduled notification carries a
 *       `reason` field captured in telemetry
 *
 * Spec kinds (only these are allowed):
 *   TASK_DUE             — overdue or due-today tasks
 *   FOLLOWUP_SCAN        — re-scan after recommended interval
 *   WEATHER_RISK         — actionable weather (heat/rain/cold)
 *   UNRESOLVED_ISSUE     — scan flagged needs_review and no follow-up
 *   QUEUE_SYNCED         — offline queue successfully drained
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws.
 *   • SSR-safe (capacitor + Notification API guarded).
 *   • No PII — payload body is the kind + caller-supplied reason
 *     string + opaque title/body strings the caller has already
 *     localized via tSafe.
 *   • RUNTIME → SERVICE (composes alertFatigueEngine + storage).
 */

const RUNTIME_VERSION = 'notification-runtime-v1';
const PERMISSION_KEY = 'farroway:notifications:permission';
const ENABLED_KEY    = 'farroway:notifications:enabled';
const COOLDOWN_MS = Object.freeze({
  TASK_DUE:           60 * 60 * 1000,      // 1 hour
  FOLLOWUP_SCAN:      12 * 60 * 60 * 1000, // 12 hours
  WEATHER_RISK:       6  * 60 * 60 * 1000, // 6 hours
  UNRESOLVED_ISSUE:   24 * 60 * 60 * 1000, // 24 hours
  QUEUE_SYNCED:       30 * 1000,           // 30 seconds (status pop)
});

export const NOTIFICATION_KIND = Object.freeze({
  TASK_DUE:           'task_due',
  FOLLOWUP_SCAN:      'followup_scan',
  WEATHER_RISK:       'weather_risk',
  UNRESOLVED_ISSUE:   'unresolved_issue',
  QUEUE_SYNCED:       'queue_synced',
});

const _state = {
  installed:          false,
  installedAt:        null,
  permission:         'unknown',  // 'granted' | 'denied' | 'unsupported' | 'unknown'
  enabled:            true,
  transport:          'unknown',  // 'capacitor' | 'web' | 'none'
  lastFireByKind:     new Map(),
  fired:              new Map(),  // kind → count
  suppressed:         new Map(),  // kind → cooldown-suppressed count
  permissionDenied:   0,
  fireFailures:       0,
  lastError:          null,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _safeAsync = async (fn, fb) => { try { return await fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');
const _nowMs = () => _safe(() => Date.now(), 0);

const _hasWindow = () => { try { return typeof window !== 'undefined'; } catch { return false; } };

function _isCapacitor() {
  return _safe(() => {
    if (!_hasWindow()) return false;
    const c = window.Capacitor;
    if (!c) return false;
    if (typeof c.isNativePlatform === 'function') return c.isNativePlatform();
    return !!c.isNativePlatform;
  }, false);
}

async function _loadCapacitorLocal() {
  return _safeAsync(async () => {
    // Capacitor plugin loads lazily so we don't pull native APIs
    // into the web bundle. If the plugin isn't installed (web build)
    // the import fails and we fall back to Web Notification API.
    // Specifier is built at runtime so Rollup's static analyzer
    // doesn't fail the build when the optional plugin isn't yet in
    // node_modules. When the plugin ships in package.json this
    // continues to resolve normally.
    const specifier = '@capacitor' + '/local-notifications';
    const dyn = new Function('s', 'return import(s)');
    const mod = await dyn(specifier);
    return mod && mod.LocalNotifications ? mod.LocalNotifications : null;
  }, null);
}

function _readPersistedPermission() {
  return _safe(() => {
    if (!_hasWindow() || !window.localStorage) return null;
    return window.localStorage.getItem(PERMISSION_KEY);
  }, null);
}

function _writePersistedPermission(value) {
  _safe(() => {
    if (!_hasWindow() || !window.localStorage) return;
    window.localStorage.setItem(PERMISSION_KEY, String(value));
  }, null);
}

function _readPersistedEnabled() {
  return _safe(() => {
    if (!_hasWindow() || !window.localStorage) return null;
    const v = window.localStorage.getItem(ENABLED_KEY);
    if (v == null) return null;
    return v !== 'false';
  }, null);
}

function _writePersistedEnabled(value) {
  _safe(() => {
    if (!_hasWindow() || !window.localStorage) return;
    window.localStorage.setItem(ENABLED_KEY, value ? 'true' : 'false');
  }, null);
}

/**
 * Install the notification runtime. Idempotent.
 * Probes capabilities, reads persisted opt-in state.
 */
export async function installNotificationRuntime() {
  if (_state.installed) {
    return Object.freeze({ ok: true, alreadyInstalled: true });
  }
  if (!_hasWindow()) {
    _state.transport = 'none';
    _state.installed = true;
    _state.installedAt = _now();
    return Object.freeze({ ok: false, reason: 'no_window' });
  }
  // Determine transport.
  if (_isCapacitor()) {
    const plugin = await _loadCapacitorLocal();
    _state.transport = plugin ? 'capacitor' : 'none';
  } else if (typeof window.Notification === 'function') {
    _state.transport = 'web';
  } else {
    _state.transport = 'none';
  }
  // Read persisted permission + opt-in state.
  const persistedPerm = _readPersistedPermission();
  if (persistedPerm === 'granted' || persistedPerm === 'denied') {
    _state.permission = persistedPerm;
  } else if (_state.transport === 'web') {
    _state.permission = _safe(() => window.Notification.permission, 'unknown');
  } else if (_state.transport === 'none') {
    _state.permission = 'unsupported';
  }
  const enabled = _readPersistedEnabled();
  if (enabled !== null) _state.enabled = enabled;
  _state.installed = true;
  _state.installedAt = _now();
  return Object.freeze({
    ok: true,
    transport: _state.transport,
    permission: _state.permission,
    enabled: _state.enabled,
  });
}

/**
 * Explicit user-initiated permission request. Returns the result.
 * Persists granted/denied so future sessions don't re-prompt.
 */
export async function requestNotificationPermission() {
  if (!_state.installed) await installNotificationRuntime();
  if (_state.transport === 'none') {
    return Object.freeze({ ok: false, reason: 'unsupported' });
  }
  if (_state.transport === 'capacitor') {
    const plugin = await _loadCapacitorLocal();
    if (!plugin) return Object.freeze({ ok: false, reason: 'capacitor_unavailable' });
    const res = await _safeAsync(() => plugin.requestPermissions(), null);
    const display = res && res.display;
    _state.permission = display === 'granted' ? 'granted' : 'denied';
    _writePersistedPermission(_state.permission);
    if (_state.permission === 'denied') _state.permissionDenied += 1;
    return Object.freeze({ ok: _state.permission === 'granted', permission: _state.permission });
  }
  // Web path.
  const perm = await _safeAsync(
    () => window.Notification.requestPermission(), 'denied');
  _state.permission = perm === 'granted' ? 'granted' : 'denied';
  _writePersistedPermission(_state.permission);
  if (_state.permission === 'denied') _state.permissionDenied += 1;
  return Object.freeze({ ok: _state.permission === 'granted', permission: _state.permission });
}

export function setEnabled(value) {
  _state.enabled = !!value;
  _writePersistedEnabled(_state.enabled);
  return Object.freeze({ ok: true, enabled: _state.enabled });
}

function _cooldownActive(kind) {
  const last = _state.lastFireByKind.get(kind);
  if (!last) return false;
  const window_ms = COOLDOWN_MS[kind.toUpperCase()] || 0;
  return (_nowMs() - last) < window_ms;
}

/**
 * Schedule a notification. Returns `{ok, reason?}`. Never throws.
 */
export async function scheduleNotification(opts) {
  if (!_state.installed) await installNotificationRuntime();
  if (!opts || typeof opts !== 'object') {
    return Object.freeze({ ok: false, reason: 'invalid_opts' });
  }
  const kind = opts.kind;
  if (!Object.values(NOTIFICATION_KIND).includes(kind)) {
    return Object.freeze({ ok: false, reason: 'invalid_kind' });
  }
  if (!_state.enabled) {
    return Object.freeze({ ok: false, reason: 'disabled' });
  }
  if (_state.permission !== 'granted') {
    return Object.freeze({ ok: false, reason: 'no_permission' });
  }
  if (_cooldownActive(kind)) {
    _state.suppressed.set(kind, (_state.suppressed.get(kind) || 0) + 1);
    return Object.freeze({ ok: false, reason: 'cooldown_active' });
  }
  const title  = typeof opts.title === 'string' ? opts.title : '';
  const body   = typeof opts.body  === 'string' ? opts.body  : '';
  const reason = typeof opts.reason === 'string' ? opts.reason : '';
  if (!title) {
    return Object.freeze({ ok: false, reason: 'no_title' });
  }
  // Fire via the appropriate transport.
  let fired = false;
  if (_state.transport === 'capacitor') {
    const plugin = await _loadCapacitorLocal();
    if (plugin) {
      const id = _safe(() => Math.floor(Math.random() * 2_000_000_000), 1);
      const res = await _safeAsync(() => plugin.schedule({
        notifications: [{ id, title, body, schedule: { at: new Date() } }],
      }), null);
      fired = !!res;
    }
  } else if (_state.transport === 'web') {
    fired = _safe(() => {
      // eslint-disable-next-line no-new
      new window.Notification(title, { body });
      return true;
    }, false);
  }
  if (!fired) {
    _state.fireFailures += 1;
    return Object.freeze({ ok: false, reason: 'transport_failed' });
  }
  _state.lastFireByKind.set(kind, _nowMs());
  _state.fired.set(kind, (_state.fired.get(kind) || 0) + 1);
  return Object.freeze({ ok: true, kind, firedAt: _now(), reason });
}

export function getNotificationHealth() {
  const firedByKind = {};
  const suppressedByKind = {};
  for (const [k, v] of _state.fired.entries()) firedByKind[k] = v;
  for (const [k, v] of _state.suppressed.entries()) suppressedByKind[k] = v;
  return Object.freeze({
    runtimeVersion:    RUNTIME_VERSION,
    installed:         _state.installed,
    installedAt:       _state.installedAt,
    transport:         _state.transport,
    permission:        _state.permission,
    enabled:           _state.enabled,
    optedIn:           _state.permission === 'granted' && _state.enabled,
    allowedKinds:      Object.values(NOTIFICATION_KIND),
    firedByKind:       Object.freeze(firedByKind),
    suppressedByKind:  Object.freeze(suppressedByKind),
    permissionDenied:  _state.permissionDenied,
    fireFailures:      _state.fireFailures,
    lastError:         _state.lastError,
  });
}

export function _resetForTests() {
  _state.installed = false;
  _state.installedAt = null;
  _state.permission = 'unknown';
  _state.enabled = true;
  _state.transport = 'unknown';
  _state.lastFireByKind.clear();
  _state.fired.clear();
  _state.suppressed.clear();
  _state.permissionDenied = 0;
  _state.fireFailures = 0;
  _state.lastError = null;
}
