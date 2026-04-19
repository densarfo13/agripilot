/**
 * statusMachine.js — controlled transitions for V2CropCycle.lifecycleStatus.
 *
 * Allowed paths:
 *   planned        -> planting
 *   planting       -> growing | delayed | failed
 *   growing        -> flowering | delayed | failed | harvest_ready
 *   flowering      -> harvest_ready | delayed | failed
 *   harvest_ready  -> harvested | failed
 *   any active     -> delayed | failed
 *   delayed        -> planting | growing | flowering | harvest_ready | failed
 *
 * Terminal states: harvested, failed.
 */

const ALLOWED_TRANSITIONS = Object.freeze({
  planned:        new Set(['planting', 'delayed', 'failed']),
  planting:       new Set(['growing', 'delayed', 'failed']),
  growing:        new Set(['flowering', 'harvest_ready', 'delayed', 'failed']),
  flowering:      new Set(['harvest_ready', 'delayed', 'failed']),
  harvest_ready:  new Set(['harvested', 'failed']),
  delayed:        new Set(['planting', 'growing', 'flowering', 'harvest_ready', 'failed']),
  // Terminal
  harvested:      new Set(),
  failed:         new Set(),
});

const ALL_STATUSES = new Set(Object.keys(ALLOWED_TRANSITIONS));

export function isValidStatus(s) {
  return ALL_STATUSES.has(String(s || '').toLowerCase());
}

/**
 * Determine whether a transition is allowed.
 * A null/undefined `from` is treated as "new cycle" and may only
 * land on `planned` or `planting`.
 */
export function canTransition(from, to) {
  const next = String(to || '').toLowerCase();
  if (!ALL_STATUSES.has(next)) return false;
  if (!from) return next === 'planned' || next === 'planting';
  const set = ALLOWED_TRANSITIONS[String(from).toLowerCase()];
  return !!set && set.has(next);
}

/**
 * Return a typed error the service/route layer can throw.
 */
export function transitionError(from, to) {
  const err = new Error('invalid_status_transition');
  err.status = 409;
  err.code = 'invalid_status_transition';
  err.from = from || null;
  err.to = to || null;
  return err;
}

export const TERMINAL_STATUSES = Object.freeze(['harvested', 'failed']);
export const ACTIVE_STATUSES = Object.freeze([
  'planned', 'planting', 'growing', 'flowering', 'harvest_ready', 'delayed',
]);
