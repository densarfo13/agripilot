/**
 * consoleFilter — suppress noisy non-app browser console spam.
 *
 * PROBLEM SOLVED
 * ──────────────
 * Chrome extensions, browser internals, and third-party shared
 * services fire their own console messages directly into the app's
 * DevTools console. This drowns out the Farroway diagnostic lines
 * that engineers and field support need to read quickly.
 *
 * Specific offenders (all confirmed via field support captures):
 *   • chrome-extension://      — any extension message
 *   • tabs:outgoing.message.ready   — Chrome tab-messaging channel
 *   • cornhusk/shared-service  — third-party analytics SDK noise
 *   • [webpack]                — dev-server leak (shouldn't appear in prod)
 *   • [vite]                   — vite HMR (shouldn't appear in prod)
 *
 * STRATEGY
 * ────────
 *   Denylist approach (NOT allowlist).
 *   Farroway has too many diagnostic console lines to enumerate;
 *   suppressing known-noisy patterns is safer and cheaper.
 *
 *   In production   — noisy pattern denylist is active.
 *   In development  — NO override (engineers need everything).
 *
 * INSTALL
 * ───────
 *   Call installConsoleFilter() ONCE at the very top of main.jsx,
 *   before any imports that might log. Idempotent — safe to call
 *   multiple times (second call is a no-op).
 *
 * SAFETY
 * ──────
 *   • Never suppresses console.error — errors always surface.
 *   • Never throws — wrapped in try/catch.
 *   • Only runs in a browser (window guard).
 *   • Stores originals on console._farroway_orig_* so they can
 *     be restored in tests via restoreConsole().
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • No React dependency — plain JS module.
 *   • No side-effects on import — must call installConsoleFilter().
 *   • SSR-safe — window guard.
 */

// ─── Patterns that are ALWAYS suppressed ─────────────────────────
// Each entry is tested with String.prototype.includes() against
// the stringified first argument of the console call.
const DENY_PATTERNS = [
  'chrome-extension://',                       // any Chrome extension log
  'tabs:outgoing.message.ready',               // Chrome tab internal channel
  'cornhusk/shared-service',                   // third-party SDK noise
  '[webpack]',                                 // webpack dev-server leak
  '[HMR]',                                     // Vite / webpack hot-module replacement
  'Download the React DevTools',               // React suggestion (production build)
  'You are running React in development mode', // React dev warning
  'content-script.js',                         // extension content-script injection noise
  'Invalid URL',                               // extension URL parse errors leaking into app
  '[BOOT] ',                                   // FarmerDashboardPage verbose boot spam
  '[FARROWAY_PAINT]',                          // blank-screen watchdog success branch (verbose)
  'PilotHome mounted',                         // PilotHome lifecycle spam
  'Live weather source:',                      // weather hook verbose trace
  'Live weather type:',                        // weather hook verbose trace
  // Production audit (May 2026) — silence the calm app-version
  // diagnostics that ship from main.jsx so the console reads
  // clean for QA + investor-demo screen recordings. The
  // structured `[Farroway]` stamps from forceUiReset.js still
  // surface (those carry the build version + runtime-stable
  // marker the field-support team greps for).
  'Farroway restored stable pilot v1',
  'Farmer profile fallback active',
  'Auth exists:',
  'Onboarding complete:',
  'Migration ran:',
  'LocalStorage keys:',
];

// ─── State ────────────────────────────────────────────────────────
let _installed = false;

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Return true if the first argument of a console call matches
 * any deny pattern. We only test the first argument because
 * that is where the meaningful prefix/tag always lives.
 *
 * @param {unknown[]} args
 * @returns {boolean}
 */
function _shouldSuppress(args) {
  try {
    if (!args || args.length === 0) return false;
    const first = String(args[0]);
    for (const pattern of DENY_PATTERNS) {
      if (first.includes(pattern)) return true;
    }
  } catch { /* never throw from filter */ }
  return false;
}

/**
 * Wrap a console method with the denylist filter.
 * The original is preserved on `console._farroway_orig_<name>`.
 *
 * @param {'log'|'warn'|'info'|'debug'|'group'|'groupCollapsed'} method
 */
function _wrapMethod(method) {
  if (typeof console[method] !== 'function') return;
  // Don't double-wrap.
  if (console[`_farroway_orig_${method}`]) return;

  const original = console[method].bind(console);
  console[`_farroway_orig_${method}`] = original;

  console[method] = (...args) => {
    if (_shouldSuppress(args)) return;
    original(...args);
  };
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Install the console filter.  Call once at app boot, before
 * React mounts.  Second+ calls are no-ops.
 *
 * Only activates in production — dev builds are left untouched
 * so engineers still see everything.
 */
export function installConsoleFilter() {
  try {
    // Browser-only.
    if (typeof window === 'undefined') return;

    // Dev builds — no filtering.
    const isDev = typeof import.meta !== 'undefined'
      && import.meta.env?.DEV === true;
    if (isDev) return;

    // Idempotent guard.
    if (_installed) return;
    _installed = true;

    // Wrap non-error methods only. console.error always surfaces.
    _wrapMethod('log');
    _wrapMethod('warn');
    _wrapMethod('info');
    _wrapMethod('debug');
    _wrapMethod('group');
    _wrapMethod('groupCollapsed');
  } catch { /* never throw from console setup */ }
}

/**
 * Restore all original console methods.
 * Useful in tests to undo the filter between test suites.
 */
export function restoreConsole() {
  try {
    for (const method of ['log', 'warn', 'info', 'debug', 'group', 'groupCollapsed']) {
      const orig = console[`_farroway_orig_${method}`];
      if (orig) {
        console[method] = orig;
        delete console[`_farroway_orig_${method}`];
      }
    }
    _installed = false;
  } catch { /* swallow */ }
}

/**
 * Check whether the filter is currently installed.
 * @returns {boolean}
 */
export function isConsoleFilterActive() {
  return _installed;
}

// ─── Global window error / rejection isolation ────────────────────

/**
 * Return true when a window ErrorEvent or PromiseRejectionEvent
 * can be traced back to a browser extension rather than the app.
 *
 * Checks both the event's filename attribute and the error stack —
 * extensions inject from chrome-extension:// or moz-extension://
 * URLs, and those strings appear in both locations reliably.
 *
 * @param {ErrorEvent|PromiseRejectionEvent} ev
 * @returns {boolean}
 */
function _isExtensionError(ev) {
  try {
    const EXTENSION_PREFIXES = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];
    // ErrorEvent has .filename; PromiseRejectionEvent has .reason with .stack
    const filename = ev?.filename || '';
    const stack = ev?.error?.stack || ev?.reason?.stack || '';
    for (const prefix of EXTENSION_PREFIXES) {
      if (filename.includes(prefix) || stack.includes(prefix)) return true;
    }
  } catch { /* never throw from filter */ }
  return false;
}

let _globalErrorFilterInstalled = false;

/**
 * Install capture-phase window listeners that intercept errors
 * originating from browser extensions before they reach analytics
 * listeners (which use bubble phase).
 *
 * Calling this BEFORE installCrashListeners() ensures extension
 * errors are stopped before they fire an `app_error` analytics
 * event or pollute the ring-buffer crash log.
 *
 * Idempotent — safe to call multiple times.
 * Only runs in browser environments — no-op in SSR / tests.
 */
export function installGlobalErrorFilter() {
  try {
    if (typeof window === 'undefined') return;
    if (_globalErrorFilterInstalled) return;
    _globalErrorFilterInstalled = true;

    window.addEventListener('error', (ev) => {
      try {
        if (_isExtensionError(ev)) {
          ev.stopImmediatePropagation();
        }
      } catch { /* never throw from filter */ }
    }, /* capture phase */ true);

    window.addEventListener('unhandledrejection', (ev) => {
      try {
        if (_isExtensionError(ev)) {
          ev.stopImmediatePropagation();
        }
      } catch { /* never throw from filter */ }
    }, /* capture phase */ true);
  } catch { /* never throw from setup */ }
}

export default installConsoleFilter;
