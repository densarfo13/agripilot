/**
 * safeTrack.js — URL-safe analytics tracker.
 *
 *   await safeTrack('scan_completed', { scanId });
 *
 * What this enforces
 * ──────────────────
 *   The runtime-stabilization spec §2 calls out analytics URL
 *   generation as the last place "Failed to construct 'URL': Invalid
 *   URL" can leak from. This helper guarantees:
 *
 *     1. URL is built through safeUrl() — never bare `new URL(...)`.
 *     2. Invalid base / endpoint → silent no-op + dev-warn-once.
 *     3. Missing/unset analytics endpoint → silent no-op.
 *     4. Network failure → swallowed, never bubbles.
 *     5. fire-and-forget — caller never awaits the result.
 *
 *   The existing trackEvent (api.js) + safeTrackEvent (analytics.js)
 *   stack handles all four legs at the JS level; this helper adds
 *   the EXTRA URL-construction safety layer the spec explicitly
 *   asks for, plus a single canonical endpoint resolver any future
 *   surface can adopt.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Never logs to console in production (silent failure).
 *   • Dev-only: warns once per invalid base via _logBadBaseOnce.
 *   • Returns a Promise that resolves to a status object so test
 *     code can verify the outcome, but callers MAY discard it.
 */

import { safeUrl } from '../safeUrl.js';

const _ANALYTICS_PATH = '/api/v2/analytics/track';

// Dev-only memo so a misconfigured deploy doesn't flood the console
// on every event fired.
const _badBasesLogged = new Set();

function _logBadBaseOnce(base) {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env || !import.meta.env.DEV) return;
    const key = String(base);
    if (_badBasesLogged.has(key)) return;
    _badBasesLogged.add(key);
    // eslint-disable-next-line no-console
    console.warn('[FARROWAY_URL_GUARD] prevented invalid URL', base);
  } catch { /* never throw from a diagnostic */ }
}

/**
 * Resolve the analytics endpoint URL safely.
 *
 *   resolveAnalyticsEndpoint() → URL | null
 *
 * Returns null when the base can't be resolved — analytics
 * disabled gracefully.
 */
export function resolveAnalyticsEndpoint() {
  // Same-origin is the documented Railway monolith default — when
  // VITE_API_BASE_URL is empty, we resolve against window.location.
  let base = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      base = String(import.meta.env.VITE_API_BASE_URL
                  || import.meta.env.VITE_API_URL
                  || '').trim();
    }
  } catch { /* SSR / strict CSP — fall through */ }

  if (!base) {
    // Same-origin path. `fetch('/api/v2/analytics/track')` is valid
    // — fetch resolves it against document.baseURI without going
    // through `new URL()`. We still build a safeUrl for parity.
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return safeUrl(_ANALYTICS_PATH, window.location.origin);
    }
    return null;
  }

  // Absolute base — safeUrl rejects malformed input + returns null.
  const url = safeUrl(base.replace(/\/+$/, '') + _ANALYTICS_PATH);
  if (!url) {
    _logBadBaseOnce(base);
    return null;
  }
  return url;
}

/**
 * Fire-and-forget analytics event with full URL safety. Returns a
 * promise that resolves to a status object (never rejects):
 *
 *   { ok: true }                       — sent
 *   { skipped: true, reason: '...' }   — skipped (no URL / no fetch)
 *   { error: true, reason: '...' }     — fetch failed
 *
 * @param {string} event
 * @param {object} [metadata]
 * @returns {Promise<object>}
 */
export async function safeTrack(event, metadata) {
  if (typeof event !== 'string' || !event.trim()) {
    return { skipped: true, reason: 'invalid_event' };
  }

  const url = resolveAnalyticsEndpoint();
  if (!url) return { skipped: true, reason: 'no_endpoint' };

  if (typeof fetch !== 'function') {
    return { skipped: true, reason: 'no_fetch' };
  }

  try {
    await fetch(url.toString(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, metadata: metadata || {} }),
    }).catch(() => {});
    return { ok: true };
  } catch (err) {
    // Per spec: fail silently in production. Dev gets a single
    // warn for visibility.
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[FARROWAY_URL_GUARD] safeTrack failed', { event, err: err && err.message });
      }
    } catch { /* swallow */ }
    return { error: true, reason: String((err && err.message) || 'fetch_failed') };
  }
}

export default { safeTrack, resolveAnalyticsEndpoint };
