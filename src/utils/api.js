/**
 * api.js — `safeFetch` wrapper that never throws.
 *
 * Used by quick-and-dirty fetches in new code paths where a
 * thrown network error would crash the surrounding component.
 * Returns null on:
 *   * fetch unavailable (SSR / very-old browser)
 *   * network failure / abort
 *   * non-2xx response
 *   * non-JSON body / JSON parse failure
 *
 * The existing `src/api/client.js` axios stack remains the
 * canonical client for the main app. This helper is for the new
 * sales / metrics / one-shot pages that don't need axios + auth
 * interceptors.
 *
 * Strict rule audit:
 *   * never throws synchronously OR asynchronously
 *   * pure: no I/O beyond the fetch + a single console.warn on
 *     non-ok status (gated behind dev mode)
 *   * additive: nothing else has to change
 */

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * safeFetch(url, options?)
 *   -> Promise<parsedJson | null>
 *
 * Options shape mirrors the native fetch second-arg. A custom
 * `parse` option is honoured when the caller wants something
 * other than JSON:
 *
 *   safeFetch('/api/csv', { parse: 'text' })
 *   safeFetch('/api/blob', { parse: 'blob' })
 */
export async function safeFetch(url, options = {}) {
  if (!url) return null;
  if (typeof fetch !== 'function') return null;

  const { parse = 'json', ...fetchOpts } = options || {};

  let res;
  try {
    res = await fetch(url, fetchOpts);
  } catch (err) {
    if (_isDev()) {
      try { console.warn('[safeFetch] fetch threw:', err && err.message); }
      catch { /* console missing */ }
    }
    return null;
  }

  if (!res || !res.ok) {
    if (_isDev()) {
      try { console.warn('[safeFetch] non-ok status:', res && res.status, url); }
      catch { /* console missing */ }
    }
    return null;
  }

  try {
    if (parse === 'text') return await res.text();
    if (parse === 'blob') return await res.blob();
    if (parse === 'response') return res;
    return await res.json();
  } catch (err) {
    if (_isDev()) {
      try { console.warn('[safeFetch] parse threw:', err && err.message); }
      catch { /* console missing */ }
    }
    return null;
  }
}

/**
 * safeJson(value, fallback)
 *   - JSON.parse with a fallback. Pure helper for components
 *     that read raw localStorage strings.
 */
export function safeJson(value, fallback = null) {
  if (typeof value !== 'string' || !value) return fallback;
  try { return JSON.parse(value); }
  catch { return fallback; }
}
