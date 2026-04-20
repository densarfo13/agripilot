/**
 * src/core/farm/unified.js — the "Farroway core system (unified
 * fix)" exposed as one clean API surface. Implements the 11
 * non-component sections of the spec:
 *
 *   1.  useFarmStoreUnified — zustand global store
 *   2.  recomputeAll(farmId)
 *   3.  resolveText(value, t)
 *   4.  SIZE_UNITS
 *   5.  goToCropFit(navigate)
 *   6.  useCropSelection(crop, farmStore)
 *   7.  createFarm(data, farmStore)
 *   8.  updateFarmDetails(data, farmStore)
 *   9.  switchFarm(farm, farmStore)
 *   10. changeLanguage(lang, i18n, farmStore)
 *   11. showToast(message)
 *
 * Component section 12 (SizeUnitDropdown) lives in
 * src/components/farm/SizeUnitDropdown.jsx so this file stays
 * framework-light and unit-testable.
 *
 * Backing services:
 *   • Backend endpoints use the real Farroway paths
 *     (/api/v2/farm-profile/*) — spec placeholders like
 *     /api/farm/:id would 404 against the actual server.
 *   • `window.location.href` is used for post-action navigation
 *     per spec — the full reload guarantees every cached
 *     derived view (Home, Tasks, Progress, Recommendations)
 *     picks up the new active farm.
 *   • `recomputeAll` is best-effort — errors swallowed to console
 *     so a transient network blip doesn't break the UI.
 */

import { create } from 'zustand';
import api from '../../api/client.js';

// ─── 1. GLOBAL STORE ─────────────────────────────────────────
// Named `useFarmStoreUnified` to avoid colliding with the
// existing offline-aware `useFarmStore` in src/store/farmStore.js.
// Same shape the spec prescribes. Can be used standalone or
// alongside the legacy store while migration completes.
export const useFarmStoreUnified = create((set) => ({
  currentFarm: null,
  farms: [],

  setCurrentFarm: (farm) => set({ currentFarm: farm }),
  setFarms:       (farms) => set({ farms }),
  updateFarm:     (updated) =>
    set((state) => ({
      currentFarm: updated,
      farms: state.farms.map((f) => (f && f.id === updated?.id ? updated : f)),
    })),
}));

// ─── 2. RECOMPUTE ENGINE ─────────────────────────────────────
/**
 * recomputeAll — fire the three derived-view refreshes in
 * parallel. Endpoints map to the real Farroway backend paths.
 * All errors are swallowed — UI stays up even when one
 * dependent fetch fails (common offline case).
 */
export async function recomputeAll(farmId) {
  if (!farmId) return { ok: false, reason: 'missing_farm_id' };
  const results = await Promise.allSettled([
    api.get(`/v2/farm-profile/${farmId}`).catch(() => null),
    api.get(`/v2/tasks?farmId=${encodeURIComponent(farmId)}`).catch(() => null),
    api.get(`/v2/recommendations?farmId=${encodeURIComponent(farmId)}`).catch(() => null),
  ]);
  const errors = results
    .map((r, i) => r.status === 'rejected' ? { i, reason: r.reason?.message } : null)
    .filter(Boolean);
  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[farroway.recompute] partial failure', errors);
  }
  return { ok: errors.length === 0, errors };
}

// ─── 3. LANGUAGE HELPER ──────────────────────────────────────
/**
 * resolveText — accept either a plain string (already rendered)
 * or a LocalizedPayload `{key, params?}` and return a string.
 * Thin wrapper around t() for call sites that don't want to
 * pull in renderLocalizedMessage.
 */
export function resolveText(value, t) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.key) {
    if (typeof t !== 'function') return value.fallback || value.key;
    return t(value.key, value.params || {});
  }
  return '';
}

// ─── 4. SIZE UNITS ───────────────────────────────────────────
export const SIZE_UNITS = Object.freeze([
  Object.freeze({ value: 'acres',    label: 'Acres',    labelKey: 'setup.acres' }),
  Object.freeze({ value: 'hectares', label: 'Hectares', labelKey: 'setup.hectares' }),
]);

// ─── 5. FIND BEST CROP FLOW ──────────────────────────────────
/**
 * goToCropFit — spec-compatible entry point. Existing users
 * should use resolveFindBestCropRoute (src/core/multiFarm/)
 * instead; this stays here for spec compatibility and the
 * first-time onboarding case.
 */
export function goToCropFit(navigate) {
  if (typeof navigate !== 'function') return;
  // Fast onboarding is the first-time crop-fit destination;
  // /crop-fit is the legacy wizard (kept only for existing
  // wizard state entries).
  navigate('/onboarding/fast');
}

// ─── 6. USE CROP (swap active farm's crop) ───────────────────
export async function useCropSelection(crop, farmStore, opts = {}) {
  if (!crop)      return { ok: false, reason: 'missing_crop' };
  if (!farmStore) return { ok: false, reason: 'missing_store' };
  const { currentFarm, updateFarm } = farmStore;
  if (!currentFarm?.id) return { ok: false, reason: 'no_active_farm' };

  try {
    const { data } = await api.patch(`/v2/farm-profile/${currentFarm.id}`, { cropType: crop });
    const updated = data?.profile || data || { ...currentFarm, cropType: crop };
    updateFarm(updated);
    await recomputeAll(updated.id);
    if (!opts.skipNav) {
      // Full reload so Home/Tasks/Progress all pick up the new crop.
      window.location.href = '/dashboard';
    }
    return { ok: true, farm: updated };
  } catch (err) {
    return { ok: false, reason: 'api_failed', message: err?.message || 'unknown' };
  }
}

// ─── 7. CREATE NEW FARM ──────────────────────────────────────
export async function createFarm(data, farmStore, opts = {}) {
  if (!farmStore) return { ok: false, reason: 'missing_store' };
  const { farms, setFarms, setCurrentFarm } = farmStore;
  try {
    const { data: resp } = await api.post('/v2/farm-profile/new', data || {});
    const farm = resp?.profile || resp;
    if (!farm?.id) return { ok: false, reason: 'api_shape' };
    setFarms([...(farms || []), farm]);
    setCurrentFarm(farm);
    await recomputeAll(farm.id);
    if (!opts.skipNav) window.location.href = '/dashboard';
    return { ok: true, farm };
  } catch (err) {
    return { ok: false, reason: 'api_failed', message: err?.message || 'unknown' };
  }
}

// ─── 8. EDIT FARM ────────────────────────────────────────────
export async function updateFarmDetails(data, farmStore, opts = {}) {
  if (!farmStore) return { ok: false, reason: 'missing_store' };
  const { currentFarm, updateFarm } = farmStore;
  if (!currentFarm?.id) return { ok: false, reason: 'no_active_farm' };
  try {
    const { data: resp } = await api.patch(`/v2/farm-profile/${currentFarm.id}`, data || {});
    const updated = resp?.profile || resp || { ...currentFarm, ...(data || {}) };
    updateFarm(updated);
    await recomputeAll(updated.id);
    if (!opts.skipNav) window.location.href = '/my-farm';
    return { ok: true, farm: updated };
  } catch (err) {
    return { ok: false, reason: 'api_failed', message: err?.message || 'unknown' };
  }
}

// ─── 9. SWITCH FARM ──────────────────────────────────────────
export async function switchFarm(farm, farmStore, opts = {}) {
  if (!farm?.id)  return { ok: false, reason: 'missing_farm' };
  if (!farmStore) return { ok: false, reason: 'missing_store' };
  const { setCurrentFarm } = farmStore;
  try {
    // Activate server-side so the new farm becomes the default.
    try { await api.post(`/v2/farm-profile/${farm.id}/activate`); }
    catch { /* non-blocking — client still switches */ }
    setCurrentFarm(farm);
    await recomputeAll(farm.id);
    if (!opts.skipNav) window.location.href = '/dashboard';
    return { ok: true, farm };
  } catch (err) {
    return { ok: false, reason: 'api_failed', message: err?.message || 'unknown' };
  }
}

// ─── 10. LANGUAGE SWITCH ─────────────────────────────────────
/**
 * changeLanguage — swap the active UI language and re-run
 * recomputes for the current farm so any locale-dependent
 * derived views refresh.
 *
 * Accepts two i18n shapes:
 *   • { changeLanguage: async (lang) => void }  (i18next)
 *   • { setLanguage: (lang) => void }           (Farroway's own)
 */
export async function changeLanguage(lang, i18n, farmStore) {
  if (!lang) return { ok: false, reason: 'missing_lang' };
  try {
    if (i18n && typeof i18n.changeLanguage === 'function') {
      await i18n.changeLanguage(lang);
    } else if (i18n && typeof i18n.setLanguage === 'function') {
      i18n.setLanguage(lang);
    } else if (i18n && typeof i18n.setLang === 'function') {
      i18n.setLang(lang);
    }
  } catch (err) {
    // Don't block; we still try to recompute.
    // eslint-disable-next-line no-console
    console.warn('[farroway.lang] change failed', err?.message);
  }
  const currentFarm = farmStore && farmStore.currentFarm;
  if (currentFarm?.id) {
    await recomputeAll(currentFarm.id);
  }
  return { ok: true, lang };
}

// ─── 11. TOAST ───────────────────────────────────────────────
/**
 * showToast — minimal notification helper. Swappable: the
 * `toastHandler` override lets apps plug in a real toast
 * library. Falls back to `alert()` per spec.
 */
let _toastHandler = null;

export function setToastHandler(handler) {
  _toastHandler = typeof handler === 'function' ? handler : null;
}

export function showToast(message) {
  if (!message) return;
  if (_toastHandler) {
    try { _toastHandler(String(message)); return; }
    catch { /* fall through */ }
  }
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    try { window.alert(String(message)); } catch { /* noop */ }
  }
}

// ─── Internal helpers for tests ──────────────────────────────
export const _internal = { get toastHandler() { return _toastHandler; } };
