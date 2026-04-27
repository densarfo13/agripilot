/**
 * safeStorage.js — defensive localStorage helpers shared by every
 * Farroway core module.
 *
 * Goals (per spec strict rules):
 *   * never crash if data is missing
 *   * never crash if localStorage throws (private mode, quota,
 *     SSR / non-browser environment)
 *   * always return a usable value
 *
 * Three helpers:
 *   safeParse(raw, fallback)  - JSON.parse with fallback on throw
 *   safeRead(key, fallback)   - read + parse + fallback in one shot
 *   safeWrite(key, value)     - JSON.stringify + setItem in try/catch
 */

export function safeParse(raw, fallback) {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function safeRead(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return safeParse(raw, fallback);
  } catch {
    return fallback;
  }
}

export function safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    /* quota exceeded / private mode - non-fatal */
    return false;
  }
}

export function safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}
