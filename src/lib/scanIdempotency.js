/**
 * scanIdempotency.js — duplicate-scan guard (protects provider credits).
 *
 * A double-tap on the scan button or a re-fired submit can send the SAME image to
 * the providers twice — wasting a credit and confusing the farmer with two results.
 * This is a tiny, FAIL-OPEN guard: it only blocks a scan it is CERTAIN is a
 * duplicate (same key already in flight, or an identical key completed within a
 * short window). On any doubt it allows the scan — it must never block a legitimate
 * one. Pure, total, never throws.
 */
const WINDOW_MS = 6000;           // a re-submit of the same key within 6s = duplicate
const _inFlight = new Map();      // key -> startedAt
const _recent = new Map();        // key -> completedAt

function _now(nowMs) { if (Number.isFinite(nowMs)) return nowMs; try { return Date.now(); } catch { return 0; } }

function _sweep(now) {
  try {
    for (const [k, t] of _recent) if (now - t > WINDOW_MS) _recent.delete(k);
    // Stale in-flight (a scan that never called endScan, e.g. a crash) is cleared
    // after a generous timeout so the key isn't blocked forever.
    for (const [k, t] of _inFlight) if (now - t > WINDOW_MS * 5) _inFlight.delete(k);
  } catch { /* never throw */ }
}

/**
 * Begin a scan. Returns true if it should proceed, false if it is a duplicate.
 * FAIL-OPEN: returns true on any internal error.
 * @param {string} key  stable per-scan key (session id / image id)
 * @param {number} [nowMs]
 */
export function beginScan(key, nowMs) {
  try {
    const k = String(key || '').trim();
    if (!k) return true;                       // no key → cannot dedup → allow
    const now = _now(nowMs);
    _sweep(now);
    if (_inFlight.has(k)) return false;        // already running → duplicate
    const done = _recent.get(k);
    if (done != null && (now - done) <= WINDOW_MS) return false; // just completed → duplicate
    _inFlight.set(k, now);
    return true;
  } catch { return true; }
}

/** Mark a scan complete so a fresh re-scan of a NEW key isn't blocked. */
export function endScan(key, nowMs) {
  try {
    const k = String(key || '').trim();
    if (!k) return;
    const now = _now(nowMs);
    _inFlight.delete(k);
    _recent.set(k, now);
  } catch { /* never throw */ }
}

export function scanIdempotencyStats() {
  return Object.freeze({ inFlight: _inFlight.size, recent: _recent.size, windowMs: WINDOW_MS });
}

export function resetScanIdempotency() { _inFlight.clear(); _recent.clear(); }
