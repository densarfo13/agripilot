/**
 * growMode.js — lightweight store for farroway_active_grow_mode.
 *
 * Tracks the farmer's explicit Farms / Gardens toggle choice,
 * independent of whether they have any entities of that type yet.
 * This lets the UI switch modes even for new users who tap "Gardens"
 * before adding a garden record.
 *
 * Storage key : farroway_active_grow_mode  ('farm' | 'garden')
 * Default     : 'farm'
 *
 * Cross-tab sync fires via the 'storage' event automatically
 * (localStorage setItem triggers it in other tabs). Same-tab
 * consumers subscribe to GROW_MODE_EVENT.
 *
 * Rules
 *   • No React imports — pure ESM module.
 *   • Never throws — every storage / dispatch call is guarded.
 *   • No network, no blocking I/O.
 */

export const GROW_MODE_KEY     = 'farroway_active_grow_mode';
export const GROW_MODE_EVENT   = 'farroway:grow_mode_changed';
export const GROW_MODE_DEFAULT = 'farm';

// ── Read ─────────────────────────────────────────────────────────

/**
 * readGrowMode() → 'farm' | 'garden'
 * Returns the persisted mode, or 'farm' if nothing is saved yet
 * or localStorage is unavailable.
 */
export function readGrowMode() {
  try {
    if (typeof localStorage === 'undefined') return GROW_MODE_DEFAULT;
    const v = localStorage.getItem(GROW_MODE_KEY);
    if (v === 'garden' || v === 'farm') return v;
  } catch { /* swallow */ }
  return GROW_MODE_DEFAULT;
}

// ── Write ─────────────────────────────────────────────────────────

/**
 * writeGrowMode(mode) → void
 * Persists the mode and dispatches GROW_MODE_EVENT so same-tab
 * listeners (useGrowMode hooks) can re-render immediately.
 * Invalid values are coerced to 'farm'.
 */
export function writeGrowMode(mode) {
  const v = mode === 'garden' ? 'garden' : 'farm';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GROW_MODE_KEY, v);
    }
  } catch { /* swallow — quota / private-mode errors */ }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(GROW_MODE_EVENT, { detail: { mode: v } }),
      );
    }
  } catch { /* swallow */ }
}
