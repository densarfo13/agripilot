/**
 * farmerJourney.js — single source of truth for where the farmer is
 * in the onboarding → active-farming → harvest lifecycle.
 *
 *   localStorage["farroway.journeyState"] = {
 *     state:        'onboarding' | 'crop_selected' | 'planning'
 *                 | 'active_farming' | 'harvest' | 'post_harvest',
 *     enteredAt:    number,     // epoch ms when we entered `state`
 *     crop:         string | null,
 *     farmId:       string | null,
 *     plantedAt:    number | null,
 *     harvestedAt:  number | null,
 *     lastUpdatedAt:number,
 *     history:      [{ state, at }]   // capped at 16 entries
 *   }
 *
 * All writes pass through `setJourneyState` so the `history` is
 * kept consistent. Reads degrade cleanly when storage is missing
 * (SSR / locked-down WebView / tests).
 */

const STORAGE_KEY = 'farroway.journeyState';

export const STATES = Object.freeze([
  'onboarding',
  'crop_selected',
  'planning',
  'active_farming',
  'harvest',
  'post_harvest',
]);

const STATE_SET = new Set(STATES);
const HISTORY_CAP = 16;

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRaw() {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function writeRaw(obj) {
  if (!hasStorage()) return false;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); return true; }
  catch { return false; }
}

export function getJourneyState() {
  const raw = readRaw();
  if (!raw || !STATE_SET.has(raw.state)) {
    return Object.freeze({
      state:        'onboarding',
      enteredAt:    null,
      crop:         null,
      farmId:       null,
      plantedAt:    null,
      harvestedAt:  null,
      lastUpdatedAt:null,
      history:      Object.freeze([]),
    });
  }
  const history = Array.isArray(raw.history)
    ? raw.history.filter((h) => h && STATE_SET.has(h.state))
    : [];
  return Object.freeze({
    state:         raw.state,
    enteredAt:     Number.isFinite(raw.enteredAt) ? raw.enteredAt : null,
    crop:          raw.crop || null,
    farmId:        raw.farmId || null,
    plantedAt:     Number.isFinite(raw.plantedAt)    ? raw.plantedAt    : null,
    harvestedAt:   Number.isFinite(raw.harvestedAt)  ? raw.harvestedAt  : null,
    lastUpdatedAt: Number.isFinite(raw.lastUpdatedAt) ? raw.lastUpdatedAt : null,
    history:       Object.freeze(history.slice(-HISTORY_CAP)),
  });
}

/**
 * setJourneyState — merge a patch into the stored record.
 *   • state transitions bump enteredAt + push into history
 *   • same-state writes only refresh lastUpdatedAt + provided fields
 *   • invalid states are rejected with a returned `ok: false`
 *   • never throws
 */
export function setJourneyState(patch = {}) {
  const current = readRaw() || {};
  const nextState = patch.state && STATE_SET.has(patch.state)
    ? patch.state
    : (current.state && STATE_SET.has(current.state) ? current.state : 'onboarding');
  const now = Number.isFinite(patch._now) ? patch._now : Date.now();

  const changed = patch.state && patch.state !== current.state;
  const history = Array.isArray(current.history) ? current.history.slice() : [];
  if (changed) {
    history.push({ state: nextState, at: now });
    while (history.length > HISTORY_CAP) history.shift();
  }

  const merged = {
    state:         nextState,
    enteredAt:     changed ? now : (current.enteredAt || now),
    crop:          patch.crop !== undefined ? patch.crop : (current.crop || null),
    farmId:        patch.farmId !== undefined ? patch.farmId : (current.farmId || null),
    plantedAt:     patch.plantedAt !== undefined ? patch.plantedAt : (current.plantedAt || null),
    harvestedAt:   patch.harvestedAt !== undefined ? patch.harvestedAt : (current.harvestedAt || null),
    lastUpdatedAt: now,
    history,
  };
  writeRaw(merged);
  return Object.freeze({ ok: true, state: merged });
}

/** Reset the journey back to "onboarding" — used on profile reset / sign-out. */
export function resetJourney() {
  if (!hasStorage()) return false;
  try { window.localStorage.removeItem(STORAGE_KEY); return true; }
  catch { return false; }
}

/**
 * advanceJourney — helper that only promotes FORWARD through the
 * state list. Refuses to regress (e.g. active_farming → planning)
 * unless the caller explicitly passes `{ force: true }`.
 */
export function advanceJourney(target, patch = {}) {
  if (!STATE_SET.has(target)) return { ok: false, reason: 'invalid_state' };
  const cur = getJourneyState();
  const i = STATES.indexOf(cur.state);
  const j = STATES.indexOf(target);
  if (j < i && !patch.force) return { ok: false, reason: 'regression_blocked' };
  return setJourneyState({ ...patch, state: target });
}

export const _keys = Object.freeze({ STORAGE_KEY, HISTORY_CAP });
