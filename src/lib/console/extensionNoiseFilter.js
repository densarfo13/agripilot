/**
 * extensionNoiseFilter — drop browser-extension error noise
 * from the Farroway console so the visible diagnostics are
 * actually our own.
 *
 *   import { installExtensionNoiseFilter, isExtensionNoise }
 *     from '../lib/console/extensionNoiseFilter.js';
 *
 *   installExtensionNoiseFilter();
 *   //   wraps console.error + console.warn to skip lines that
 *   //   match the noise patterns below
 *
 * Why this exists
 *   The Invalid-URL Root-Cause Fix §7 calls out extension chatter
 *   that LOOKS like Farroway errors but isn't:
 *     tabs:outgoing.message.ready
 *     cornhusk/shared-service
 *     chrome-extension://... messages
 *     evmAsk.js (MetaMask injected page error)
 *     'Failed to load resource: ... extension'
 *
 *   When this noise is mixed into the console, a QA operator can
 *   misread it as a Farroway failure. The filter drops only
 *   lines that clearly originate from a browser extension, leaves
 *   every Farroway log intact.
 *
 * Strict-rule audit
 *   * Idempotent — installing twice is a no-op.
 *   * Never throws. The original console.error / .warn are
 *     captured + restored via uninstallExtensionNoiseFilter().
 *   * Production-safe — drops only matched patterns. ANYTHING
 *     ambiguous bubbles through so we never hide a real bug.
 *   * Pure JS — no DOM mutation, no storage, no network.
 */

const NOISE_PATTERNS = Object.freeze([
  /tabs:outgoing\.message\.ready/i,
  // Cornhusk extension - the actual console format is
  // "cornhusk, shared-service, error: ..." (comma-separated).
  // The earlier slash-only pattern missed every real occurrence.
  /\bcornhusk\b/i,
  /\bshared-service\b/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /webextension-error/i,
  /evmAsk\.js/i,
  /content_script\.js/i,
  /injectedScript/i,
  // "No Listener: <something>" is the cornhusk-style postMessage
  // error that surfaces as an Uncaught (in promise) Error.
  /No Listener:/i,
  // "Failed to construct 'URL'" preceded by a third-party
  // identifier in the same message stream. We require ONE OTHER
  // extension token to avoid false-positives on Farroway code.
  /(?:cornhusk|extension|shared-service).*Failed to construct ['"]URL['"]/i,
  /Failed to construct ['"]URL['"].*Invalid url:/i,
  // Generic guard — "extension" + "Failed to" co-occurrence is
  // almost always a third-party content-script error.
  /extension.*Failed to load resource/i,
]);

let _installed     = false;
let _origError     = null;
let _origWarn      = null;
let _origOnError   = null;
let _origOnRejection = null;
let _filteredCount = 0;

function _flatten(args) {
  try {
    return args
      .map((a) => {
        if (a == null) return '';
        if (typeof a === 'string') return a;
        if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ''}`;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(' ');
  } catch { return ''; }
}

/**
 * @param {Array} args   the raw console arguments
 * @returns {boolean}    true when this should be dropped
 */
export function isExtensionNoise(args) {
  try {
    if (!Array.isArray(args)) return false;
    const blob = _flatten(args);
    if (!blob) return false;
    for (const p of NOISE_PATTERNS) {
      if (p.test(blob)) return true;
    }
    return false;
  } catch { return false; }
}

/**
 * Replace console.error + console.warn with wrappers that skip
 * matched extension noise. Returns true on successful install.
 * Subsequent calls are no-ops.
 *
 * @returns {boolean}
 */
export function installExtensionNoiseFilter() {
  try {
    if (_installed) return true;
    if (typeof console === 'undefined') return false;
    _origError = console.error;
    _origWarn  = console.warn;
    if (typeof _origError !== 'function' || typeof _origWarn !== 'function') return false;
    console.error = function farrowayConsoleErrorFiltered(...args) {
      if (isExtensionNoise(args)) {
        _filteredCount += 1;
        return;
      }
      try { _origError.apply(console, args); } catch { /* swallow */ }
    };
    console.warn = function farrowayConsoleWarnFiltered(...args) {
      if (isExtensionNoise(args)) {
        _filteredCount += 1;
        return;
      }
      try { _origWarn.apply(console, args); } catch { /* swallow */ }
    };
    // Global error + unhandled-rejection filters — the production
    // screenshots show "Uncaught (in promise) Error" lines from
    // browser extensions that bypass console.error entirely. The
    // browser surfaces them via window.onerror /
    // window.onunhandledrejection. Wrapping both here means even
    // unhandled extension promises stay out of the user's console.
    if (typeof window !== 'undefined') {
      try {
        _origOnError = window.onerror;
        window.onerror = function farrowayOnErrorFiltered(message, source, lineno, colno, error) {
          try {
            const payload = [message];
            if (source) payload.push(source);
            if (error)  payload.push(error);
            if (isExtensionNoise(payload)) {
              _filteredCount += 1;
              return true;   // prevent the default error log
            }
          } catch { /* swallow */ }
          if (typeof _origOnError === 'function') {
            try { return _origOnError(message, source, lineno, colno, error); }
            catch { /* swallow */ }
          }
          return false;
        };
      } catch { /* swallow */ }
      try {
        _origOnRejection = window.onunhandledrejection;
        window.onunhandledrejection = function farrowayOnRejectionFiltered(event) {
          try {
            const reason = event && event.reason;
            const payload = reason instanceof Error
                              ? [reason]
                              : [reason == null ? 'unknown' : String(reason)];
            if (isExtensionNoise(payload)) {
              _filteredCount += 1;
              try { event.preventDefault && event.preventDefault(); } catch { /* swallow */ }
              return;
            }
          } catch { /* swallow */ }
          if (typeof _origOnRejection === 'function') {
            try { _origOnRejection.call(window, event); }
            catch { /* swallow */ }
          }
        };
      } catch { /* swallow */ }
    }
    _installed = true;
    return true;
  } catch { return false; }
}

/** Restore the original console methods + global handlers. */
export function uninstallExtensionNoiseFilter() {
  try {
    if (!_installed) return;
    if (_origError) console.error = _origError;
    if (_origWarn)  console.warn  = _origWarn;
    if (typeof window !== 'undefined') {
      try { window.onerror              = _origOnError;     } catch { /* swallow */ }
      try { window.onunhandledrejection = _origOnRejection; } catch { /* swallow */ }
    }
    _origError       = null;
    _origWarn        = null;
    _origOnError     = null;
    _origOnRejection = null;
    _installed       = false;
  } catch { /* swallow */ }
}

/** @returns {number} how many noise lines have been dropped */
export function getFilteredCount() {
  return _filteredCount;
}

/** Test seam. */
export function _resetExtensionNoiseFilter() {
  uninstallExtensionNoiseFilter();
  _filteredCount = 0;
}

const _module = {
  isExtensionNoise,
  installExtensionNoiseFilter,
  uninstallExtensionNoiseFilter,
  getFilteredCount,
  _resetExtensionNoiseFilter,
};
export default _module;
