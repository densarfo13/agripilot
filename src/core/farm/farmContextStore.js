/**
 * farmContextStore.js — canonical activeFarm single-source-of-truth.
 *
 *   import {
 *     getActiveFarm, setActiveFarm, hydrateActiveFarm,
 *     subscribeActiveFarm, clearActiveFarm,
 *     HYDRATION_SOURCE, ACTIVE_FARM_STORAGE_KEY,
 *   } from 'src/core/farm/farmContextStore.js';
 *
 * What this is
 * ────────────
 *   The SINGLE store every farm-aware screen reads from. Replaces
 *   the scatter of duplicate sources observed in production:
 *
 *     • onboardingFarm / farmDraft / profileSetup
 *     • selectedFarm / currentFarm / activeFarm
 *     • taskFarm / gardenFarm
 *     • scan farm reference / journal farm reference
 *     • localStorage farm / IndexedDB farm
 *
 *   Hydration priority (worst→best, last writer wins):
 *     1. safe empty shell             — lowest
 *     2. onboarding draft
 *     3. local persisted activeFarm
 *     4. last active farm ID
 *     5. server / API farm profile    — highest
 *
 *   Never allow a draft to overwrite a complete farm.
 *
 *   Every crop string is normalised through normalizeCropId and
 *   rendered through getLocalizedCropName. Every location string
 *   is normalised through normalizeLocationDisplay. The store
 *   exposes the canonical shape only — `activeFarm`.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • localStorage wrapped in try/catch — quota / private mode
 *     silent-degrades to memory-only.
 *   • Subscribers fire synchronously; one throwing handler does
 *     not stop others.
 */

import { normalizeCropId } from '../../config/crops/index.js';
import { getLocalizedCropName } from '../crops/cropLocalization.ts';
import { normalizeLocationDisplay } from './normalizeLocationDisplay.js';

const ENGINE_VERSION = 'farm-context-v1';
export const ACTIVE_FARM_STORAGE_KEY = 'farroway:activeFarm:v1';

export const HYDRATION_SOURCE = Object.freeze({
  SERVER:         'server',
  LAST_ACTIVE_ID: 'last_active_id',
  LOCAL_ACTIVE:   'local_active',
  ONBOARDING:     'onboarding_draft',
  EMPTY_SHELL:    'empty_shell',
});

// Hydration priority — HIGHER number wins.
const _HYDRATION_RANK = Object.freeze({
  [HYDRATION_SOURCE.EMPTY_SHELL]:    0,
  [HYDRATION_SOURCE.ONBOARDING]:     1,
  [HYDRATION_SOURCE.LOCAL_ACTIVE]:   2,
  [HYDRATION_SOURCE.LAST_ACTIVE_ID]: 3,
  [HYDRATION_SOURCE.SERVER]:         4,
});

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── State ───────────────────────────────────────────────────

let _activeFarm = null;
let _hydrationSource = HYDRATION_SOURCE.EMPTY_SHELL;
const _subscribers = new Set();

// ─── localStorage helpers ────────────────────────────────────

function _safeGet() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ACTIVE_FARM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return _isObj(parsed) ? parsed : null;
  } catch { return null; }
}

function _safeSet(farm) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (farm == null) {
      localStorage.removeItem(ACTIVE_FARM_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_FARM_STORAGE_KEY, JSON.stringify(farm));
  } catch { /* quota / private mode — silent-degrade */ }
}

// ─── Normalizer ──────────────────────────────────────────────

/**
 * Build the canonical activeFarm envelope from any of the scattered
 * legacy shapes. Every field is coerced; missing fields stay null.
 *
 *   normalizeFarmShape({cropType:'pepper', region:'Maryland', ...})
 *     → { id, name, type, cropId, localizedCropName, location,
 *         region, country, size, sizeUnit, stage, lifecycleStage,
 *         createdAt, updatedAt, scanHistory, taskState,
 *         journalMoments, progressState, sellState, fundingState }
 */
export function normalizeFarmShape(input, opts) {
  return _safe(() => {
    if (!_isObj(input)) return _emptyShell();
    const o = _isObj(opts) ? opts : {};
    const locale = _str(o.locale) || 'en';

    // Crop normalization — accept any legacy alias and route through
    // normalizeCropId.
    const rawCrop = _str(input.cropId)
      || _str(input.crop)
      || _str(input.cropType)
      || _str(input.selectedCrop)
      || _str(input.crop_name)
      || _str(input.cropLabel)
      || _str(input.plantName);
    const cropId = _safe(() => normalizeCropId(rawCrop), '') || rawCrop || null;
    const localizedCropName = cropId
      ? _safe(() => getLocalizedCropName(cropId, locale), '') : null;

    // Location normalization — fix "United States, United States" etc.
    const rawLocation = _str(input.location) || _str(input.locationDisplay)
      || _str(input.locationString) || '';
    const region  = _str(input.region) || _str(input.state) || null;
    const country = _str(input.country) || null;
    const location = rawLocation
      ? _safe(() => normalizeLocationDisplay(rawLocation), rawLocation)
      : _safe(() => normalizeLocationDisplay({ region, country }), null);

    // Stage normalization — both `stage` and `lifecycleStage`.
    const lifecycleStage = _str(input.lifecycleStage)
      || _str(input.currentStage) || _str(input.stage) || null;
    const stage = _str(input.stage) || lifecycleStage;

    // Type
    const type = _str(input.type).toLowerCase() === 'garden' ? 'garden' : 'farm';

    return Object.freeze({
      id:                _str(input.id) || _str(input.farmId) || null,
      name:              _str(input.name) || _str(input.farmName) || null,
      type,
      crop:              cropId,
      cropId,
      localizedCropName,
      location,
      region,
      country,
      size:              _num(input.size),
      sizeUnit:          _str(input.sizeUnit) || _str(input.size_unit) || null,
      stage,
      lifecycleStage,
      createdAt:         _num(input.createdAt) || null,
      updatedAt:         _num(input.updatedAt) || Date.now(),
      scanHistory:       Array.isArray(input.scanHistory) ? Object.freeze(input.scanHistory.slice()) : Object.freeze([]),
      taskState:         _isObj(input.taskState) ? Object.freeze({ ...input.taskState }) : Object.freeze({}),
      journalMoments:    Array.isArray(input.journalMoments) ? Object.freeze(input.journalMoments.slice()) : Object.freeze([]),
      progressState:     _isObj(input.progressState) ? Object.freeze({ ...input.progressState }) : Object.freeze({}),
      sellState:         _isObj(input.sellState) ? Object.freeze({ ...input.sellState }) : Object.freeze({}),
      fundingState:      _isObj(input.fundingState) ? Object.freeze({ ...input.fundingState }) : Object.freeze({}),
    });
  }, _emptyShell());
}

function _emptyShell() {
  return Object.freeze({
    id: null, name: null, type: 'farm',
    crop: null, cropId: null, localizedCropName: null,
    location: null, region: null, country: null,
    size: null, sizeUnit: null,
    stage: null, lifecycleStage: null,
    createdAt: null, updatedAt: Date.now(),
    scanHistory:    Object.freeze([]),
    taskState:      Object.freeze({}),
    journalMoments: Object.freeze([]),
    progressState:  Object.freeze({}),
    sellState:      Object.freeze({}),
    fundingState:   Object.freeze({}),
  });
}

// ─── Hydration ───────────────────────────────────────────────

/**
 * Apply candidate inputs in priority order. Higher-rank sources
 * never get overwritten by lower-rank ones.
 *
 *   hydrateActiveFarm({
 *     server,          // API response
 *     lastActiveId,    // string id pointing at a known farm
 *     localActive,     // persisted activeFarm from localStorage
 *     onboardingDraft, // partial draft from onboarding flow
 *     locale,
 *   })
 *
 * Returns the resulting activeFarm + the source that won.
 */
export function hydrateActiveFarm(input) {
  return _safe(() => {
    const o = _isObj(input) ? input : {};
    const locale = _str(o.locale) || 'en';

    // Try each source in order — higher rank wins. We keep the
    // first complete-enough source we find.
    const candidates = [
      { source: HYDRATION_SOURCE.SERVER,         data: o.server },
      { source: HYDRATION_SOURCE.LAST_ACTIVE_ID, data: _isObj(o.lastActiveFarm) ? o.lastActiveFarm : null },
      { source: HYDRATION_SOURCE.LOCAL_ACTIVE,   data: _isObj(o.localActive) ? o.localActive : _safeGet() },
      { source: HYDRATION_SOURCE.ONBOARDING,     data: o.onboardingDraft },
    ];

    let chosen = null;
    let chosenSource = HYDRATION_SOURCE.EMPTY_SHELL;
    for (const c of candidates) {
      if (!_isObj(c.data)) continue;
      // Require at least an id OR a crop OR a name to count.
      const hasSignal = _str(c.data.id) || _str(c.data.farmId)
        || _str(c.data.crop) || _str(c.data.cropId) || _str(c.data.cropType)
        || _str(c.data.name) || _str(c.data.farmName);
      if (!hasSignal) continue;
      chosen = c.data;
      chosenSource = c.source;
      break;
    }

    const farm = chosen ? normalizeFarmShape(chosen, { locale }) : _emptyShell();
    _setInternal(farm, chosenSource);
    return Object.freeze({
      activeFarm: farm,
      hydrationSource: chosenSource,
      hydrationRank:   _HYDRATION_RANK[chosenSource] || 0,
    });
  }, Object.freeze({
    activeFarm: _emptyShell(),
    hydrationSource: HYDRATION_SOURCE.EMPTY_SHELL,
    hydrationRank: 0,
  }));
}

// ─── Public — read + write ───────────────────────────────────

export function getActiveFarm() {
  if (_activeFarm) return _activeFarm;
  return _emptyShell();
}

export function getHydrationSource() {
  return _hydrationSource;
}

/**
 * Set the active farm. Refuses to overwrite a higher-rank source
 * with a lower-rank one unless `force: true`.
 */
export function setActiveFarm(input, opts) {
  return _safe(() => {
    const o = _isObj(opts) ? opts : {};
    const source = _str(o.source) || HYDRATION_SOURCE.SERVER;
    const locale = _str(o.locale) || 'en';
    const incomingRank = _HYDRATION_RANK[source] || 0;
    const currentRank  = _HYDRATION_RANK[_hydrationSource] || 0;
    if (!o.force && incomingRank < currentRank && _activeFarm && _activeFarm.cropId) {
      // Lower-rank update for a complete farm is a no-op.
      return _activeFarm;
    }
    const normalized = normalizeFarmShape(input, { locale });
    _setInternal(normalized, source);
    return normalized;
  }, _activeFarm || _emptyShell());
}

function _setInternal(farm, source) {
  _activeFarm = farm;
  _hydrationSource = source;
  _safeSet(farm);
  _notify();
}

function _notify() {
  for (const fn of Array.from(_subscribers)) {
    _safe(() => fn(_activeFarm), null);
  }
}

/** Subscribe to activeFarm changes. Returns an unsubscribe fn. */
export function subscribeActiveFarm(fn) {
  if (typeof fn !== 'function') return () => {};
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

/** Drop the active farm — used by sign-out + tests. */
export function clearActiveFarm() {
  _activeFarm = null;
  _hydrationSource = HYDRATION_SOURCE.EMPTY_SHELL;
  _safeSet(null);
  _notify();
}

export const _internal = Object.freeze({
  _HYDRATION_RANK, _emptyShell, ENGINE_VERSION,
});

const _module = {
  HYDRATION_SOURCE, ACTIVE_FARM_STORAGE_KEY,
  getActiveFarm, setActiveFarm, hydrateActiveFarm,
  subscribeActiveFarm, clearActiveFarm,
  getHydrationSource, normalizeFarmShape,
  _internal,
};
export default _module;
