/**
 * swallowTelemetry.js — structured telemetry for caught/swallowed errors.
 *
 * The app swallows errors deliberately so a transient failure never crashes the UI
 * (graceful degradation). But a SILENT swallow hides regressions in a live pilot —
 * you can't fix what you can't see. This sink keeps the no-crash behavior AND makes
 * every swallow countable + categorized, with zero risk: it never throws, never
 * blocks, and never crashes the UI itself.
 *
 *   import { reportSwallowed, SEVERITY } from './lib/swallowTelemetry.js';
 *   try { risky(); } catch (e) { reportSwallowed(SEVERITY.WARNING, 'boot:scanV12', e); }
 *
 * Inspect at runtime:  window.__swallowedErrors()
 */
export const SEVERITY = Object.freeze({
  INFO: 'INFO', WARNING: 'WARNING', ERROR: 'ERROR', CRITICAL: 'CRITICAL',
});

const MAX_RECENT = 50;
const _state = {
  counts: { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
  recent: [],          // ring buffer of the last MAX_RECENT events
  installed: false,
};

function _msg(err) {
  try {
    if (err == null) return '';
    if (typeof err === 'string') return err.slice(0, 300);
    if (err && err.message) return String(err.message).slice(0, 300);
    return String(err).slice(0, 300);
  } catch { return 'unprintable_error'; }
}

/**
 * Record a swallowed error. Total + non-throwing — safe to call from any catch.
 * @param {string} severity  one of SEVERITY.*
 * @param {string} source    short tag, e.g. 'boot:farmAgent' / 'scan:submit'
 * @param {*}      err        the caught error (any shape)
 */
export function reportSwallowed(severity, source, err) {
  try {
    const sev = Object.prototype.hasOwnProperty.call(_state.counts, severity) ? severity : SEVERITY.WARNING;
    _state.counts[sev] += 1;
    const entry = { severity: sev, source: String(source || 'unknown').slice(0, 80), message: _msg(err), at: _now() };
    _state.recent.push(entry);
    if (_state.recent.length > MAX_RECENT) _state.recent.shift();
    // Only surface the loud ones to the console; never spam on INFO/WARNING.
    if ((sev === SEVERITY.ERROR || sev === SEVERITY.CRITICAL) && typeof console !== 'undefined' && console.warn) {
      console.warn('[swallow:' + sev + '] ' + entry.source + ' — ' + entry.message);
    }
  } catch { /* the telemetry sink itself must never throw */ }
}

function _now() {
  // Avoid Date in environments that forbid it (tests); fall back to a counter.
  try { return new Date().toISOString(); } catch { return String(_state.counts.INFO + _state.counts.WARNING + _state.counts.ERROR + _state.counts.CRITICAL); }
}

export function swallowedErrorsSnapshot() {
  return Object.freeze({
    counts: Object.freeze({ ..._state.counts }),
    total: _state.counts.INFO + _state.counts.WARNING + _state.counts.ERROR + _state.counts.CRITICAL,
    recent: Object.freeze(_state.recent.slice(-10)),
  });
}

export function resetSwallowTelemetry() {
  _state.counts = { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 };
  _state.recent = [];
}

/**
 * Install the global accessor + capture genuinely UNHANDLED errors / rejections
 * (categorized ERROR) so even non-swallowed failures are counted — without
 * crashing the UI. Idempotent + browser-safe.
 */
export function installSwallowTelemetry() {
  try {
    if (typeof window === 'undefined' || _state.installed) return;
    _state.installed = true;
    Object.defineProperty(window, '__swallowedErrors', {
      configurable: true, enumerable: false, writable: false, value: () => swallowedErrorsSnapshot(),
    });
    try {
      window.addEventListener('error', (ev) => reportSwallowed(SEVERITY.ERROR, 'window:onerror', ev && (ev.error || ev.message)));
      window.addEventListener('unhandledrejection', (ev) => reportSwallowed(SEVERITY.ERROR, 'window:unhandledrejection', ev && ev.reason));
    } catch { /* listener attach is best-effort */ }
  } catch { /* never block boot */ }
}
