/**
 * scanCorrelationId — one short, safe correlation id per scan attempt.
 *
 * The Scan spec requires: "Log every failure with a correlation ID." This gives
 * every scan attempt a single token that ties together the client crash boundary,
 * failure telemetry, and (when forwarded) the server /api/scan/analyze log — so a
 * field report or a Railway log line can be matched to one scan.
 *
 * Pure + NEVER throws (it is consumed inside the scan error boundary's catch handler,
 * which must never throw). Not farmer-facing — engineers/field-officers only.
 *
 *   import { beginScanCorrelation, getScanCorrelationId } from 'src/lib/scanCorrelationId.js';
 *   beginScanCorrelation();            // when a scan attempt starts
 *   getScanCorrelationId();            // anywhere a failure is logged
 */

let _current = null;

function _rand() {
  try { return Math.random().toString(36).slice(2, 8); } catch { return '000000'; }
}

/** Generate a fresh id: `scan-<base36 time>-<rand>`. Never throws. */
export function newScanCorrelationId() {
  try { return 'scan-' + Date.now().toString(36) + '-' + _rand(); }
  catch { return 'scan-unknown'; }
}

/** Start a new correlation for a scan attempt and return it. */
export function beginScanCorrelation() {
  _current = newScanCorrelationId();
  return _current;
}

/** Current correlation id; lazily generates one if none is active. Never throws. */
export function getScanCorrelationId() {
  try {
    if (typeof _current !== 'string' || _current.length === 0) _current = newScanCorrelationId();
    return _current;
  } catch { return 'scan-unknown'; }
}

/** Clear after a scan attempt fully resolves (next attempt gets a fresh id). */
export function clearScanCorrelation() { _current = null; }

const _module = { newScanCorrelationId, beginScanCorrelation, getScanCorrelationId, clearScanCorrelation };
export default _module;
