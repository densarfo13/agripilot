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
  'moz-extension://',                          // Firefox extension equivalent
  'safari-extension://',                       // Safari extension equivalent
  'tabs:outgoing.message.ready',               // Chrome tab internal channel (dotted)
  'tabs:outgoing_message_ready',               // Chrome tab internal channel (underscore variant)
  'tabs:incoming.message.ready',
  'tabs:outgoing',                             // catch any tabs:outgoing.* variant
  'tabs:incoming',                             // catch any tabs:incoming.* variant
  'message channel closed',                    // 'A listener indicated…message channel closed' (extension noise)
  'cornhusk',                                  // third-party SDK — match bare token regardless of delimiter
  'shared-service',                            // cornhusk SDK label (used independently of 'cornhusk')
  'No Listener:',                              // generic extension messaging leak (e.g. 'No Listener: tabs:...')
  "Failed to construct 'URL'",                 // cornhusk extension URL hook noise (wrapped TypeError)
  '[webpack]',                                 // webpack dev-server leak
  '[HMR]',                                     // Vite / webpack hot-module replacement
  'Download the React DevTools',               // React suggestion (production build)
  'You are running React in development mode', // React dev warning
  'content-script.js',                         // extension content-script injection noise
  'Invalid URL',                               // extension URL parse errors leaking into app
  '[BOOT] ',                                   // FarmerDashboardPage verbose boot spam
  '[FARROWAY_PAINT]',                          // blank-screen watchdog success branch (verbose)
  'Home mounted',                              // Home lifecycle spam
  'Live weather source:',                      // weather hook verbose trace
  'Live weather type:',                        // weather hook verbose trace
  'Event system disabled',                     // analytics + offlineQueue kill-switch diagnostic
  'Event sync disabled for pilot',             // analytics kill-switch alternate variant
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
  // Pilot readiness lockdown (May 2026 §1): suppress the
  // duplicate version-stamp lines so production console reads
  // clean. The `[Farroway] Pilot readiness build active` line
  // and `[Farroway] Active UI build:` line are kept (those are
  // the two greppable signals QA + ops rely on).
  '[Farroway] Soft Ochre platform build active',
  '[Farroway] Runtime integration stable',
  'Farroway Build:',
  'Farroway UI version:',
];

// ─── State ────────────────────────────────────────────────────────
let _installed = false;

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Return true if ANY argument of a console call (stringified)
 * matches any deny pattern. We scan every argument because the
 * cornhusk SDK has been observed passing the meaningful tag as
 * the second argument (the first arg is the bare error object
 * which stringifies to the TypeError name only).
 *
 * Argument scanning is capped at the first ~512 chars per arg
 * + first 6 args to keep the hot path cheap.
 *
 * @param {unknown[]} args
 * @returns {boolean}
 */
function _shouldSuppress(args) {
  try {
    if (!args || args.length === 0) return false;
    const limit = Math.min(args.length, 6);
    for (let i = 0; i < limit; i += 1) {
      const a = args[i];
      let s;
      try {
        if (a == null) continue;
        if (typeof a === 'string') {
          s = a;
        } else if (a instanceof Error) {
          s = `${a.name || 'Error'}: ${a.message || ''}`;
        } else {
          s = String(a);
        }
      } catch { continue; }
      if (s.length > 512) s = s.slice(0, 512);
      for (const pattern of DENY_PATTERNS) {
        if (s.includes(pattern)) return true;
      }
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

  const wrapped = (...args) => {
    if (_shouldSuppress(args)) return;
    original(...args);
  };
  console[method] = wrapped;
  _wrapped[method] = wrapped;
}

// Watchdog — re-applies the wrap if a downstream script (a Chrome
// extension that runs at document_start, typically) has replaced
// our console.warn with its own reference. Cheap (one identity
// check per method every 2 s) and self-stops on the first run
// after the page hits 30 s of uptime, by which point any late-
// loading extension content scripts have already injected.
let _watchdogTimer = null;
function _startWatchdog() {
  try {
    if (typeof window === 'undefined') return;
    if (_watchdogTimer) return;
    const stopAt = Date.now() + 30_000;
    _watchdogTimer = setInterval(() => {
      try {
        for (const m of Object.keys(_wrapped)) {
          if (console[m] !== _wrapped[m]) {
            // A downstream script swapped console[m] for its own
            // function. Reinstall our wrap; the previous
            // overrider's reference (if it stashed one) keeps
            // calling the original directly, which is the best we
            // can do without freezing the global.
            console[m] = _wrapped[m];
          }
        }
      } catch { /* swallow */ }
      if (Date.now() > stopAt) {
        try { clearInterval(_watchdogTimer); } catch { /* swallow */ }
        _watchdogTimer = null;
      }
    }, 2_000);
  } catch { /* never throw */ }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Install the console filter.  Call once at app boot, before
 * React mounts.  Second+ calls are no-ops.
 *
 * Only activates in production — dev builds are left untouched
 * so engineers still see everything.
 */
// Track each method's wrapped function so the watchdog can
// detect whether something downstream (an extension content
// script) has replaced console.warn after our install.
const _wrapped = {};

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

    _wrapMethod('log');
    _wrapMethod('warn');
    _wrapMethod('info');
    _wrapMethod('debug');
    _wrapMethod('group');
    _wrapMethod('groupCollapsed');
    // Wrap console.error too — extensions (cornhusk in particular)
    // use console.error to ship their own "shared-service, error:"
    // tag onto the page console. Real app errors typically come
    // through Sentry's beforeSend pipeline, not the bare console,
    // so suppressing extension noise here is safe. The deny-list
    // is strict-pattern; anything that doesn't match still falls
    // through to the original console.error.
    _wrapMethod('error');
    _startWatchdog();
  } catch { /* never throw from console setup */ }
}

/**
 * Restore all original console methods.
 * Useful in tests to undo the filter between test suites.
 */
export function restoreConsole() {
  try {
    for (const method of ['log', 'warn', 'info', 'debug', 'group', 'groupCollapsed', 'error']) {
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
    // Known extension-noise message patterns. Some extensions
    // inject into the page's main world; their errors then carry
    // a vendor.js / VM* filename instead of chrome-extension://.
    // Matching on the message content is the only reliable
    // signal in that case.
    const EXTENSION_MESSAGES = [
      'No Listener: tabs:',                   // generic Chrome tab-messaging rejection
      'tabs:outgoing.message.ready',
      'tabs:incoming.message.ready',
      'tabs:outgoing_message_ready',
      'tabs:incoming_message_ready',
      'message channel closed',
      'cornhusk',                             // cornhusk SDK noise
    ];
    // ErrorEvent has .filename; PromiseRejectionEvent has .reason with .stack
    const filename = ev?.filename || '';
    const stack = ev?.error?.stack || ev?.reason?.stack || '';
    for (const prefix of EXTENSION_PREFIXES) {
      if (filename.includes(prefix) || stack.includes(prefix)) return true;
    }
    // Message-based fallback for main-world-injected extensions.
    const message = String(
      ev?.error?.message
      || ev?.reason?.message
      || ev?.reason
      || ev?.message
      || ''
    );
    for (const pattern of EXTENSION_MESSAGES) {
      if (message.includes(pattern)) return true;
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
          // preventDefault stops the browser from logging
          // the extension error to the console; the propagation
          // stop keeps it out of analytics / Sentry.
          ev.preventDefault?.();
          ev.stopImmediatePropagation();
        }
      } catch { /* never throw from filter */ }
    }, /* capture phase */ true);

    window.addEventListener('unhandledrejection', (ev) => {
      try {
        if (_isExtensionError(ev)) {
          // preventDefault on unhandledrejection suppresses
          // the browser's "Uncaught (in promise) Error: ..."
          // console line — the extension's noise never reaches
          // the operator.
          ev.preventDefault?.();
          ev.stopImmediatePropagation();
        }
      } catch { /* never throw from filter */ }
    }, /* capture phase */ true);
  } catch { /* never throw from setup */ }
}

export default installConsoleFilter;
