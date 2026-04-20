/**
 * recomputeFarmContext.js — single coordination point for
 * "after a farm-affecting action, refresh the world".
 *
 * Used after:
 *   • Edit Farm save
 *   • Add New Farm save
 *   • Switch Farm
 *   • Switch crop from recommendations
 *
 * The helper is PURE — no React, no direct context access. It
 * accepts explicit dependencies so callers can:
 *   1. pass their own `refreshProfile` / `refreshFarms` /
 *      `invalidateCaches` (supports test mocks)
 *   2. collect an `intent` describing what changed
 *   3. run the steps in order, bubble up per-step errors
 *      without failing the whole chain
 *
 * Contract:
 *
 *   recomputeFarmContext({
 *     currentFarmId,
 *     intent?: { farmSwitched?, farmEdited?, farmCreated?, cropSwitched? },
 *     deps: {
 *       refreshProfile?,           // () ⇒ Promise
 *       refreshFarms?,             // () ⇒ Promise
 *       invalidateLocalizedCaches?,// (locale) ⇒ void
 *       locale?,                   // current i18n locale
 *     },
 *   })
 *     → { ok, ran: string[], errors: { step: message } }
 *
 * Never throws. Every step is wrapped — a failure in one does
 * not block the next. This is important on flaky offline networks
 * where a refresh might intermittently fail.
 */

export const STEPS = Object.freeze({
  REFRESH_PROFILE:             'refreshProfile',
  REFRESH_FARMS:               'refreshFarms',
  INVALIDATE_LOCALIZED_CACHES: 'invalidateLocalizedCaches',
});

async function safeRun(name, fn) {
  try {
    const res = typeof fn === 'function' ? await fn() : null;
    return { name, ok: true, res };
  } catch (err) {
    return { name, ok: false, error: err?.message || 'unknown' };
  }
}

export async function recomputeFarmContext({
  currentFarmId,
  intent = {},
  deps = {},
} = {}) {
  const ran = [];
  const errors = {};

  // Belt-and-braces profile refresh. editFarm already calls this
  // internally, but callers that change currentFarmId directly
  // (switch) need this to propagate.
  if (typeof deps.refreshProfile === 'function') {
    const r = await safeRun(STEPS.REFRESH_PROFILE, deps.refreshProfile);
    ran.push(r.name);
    if (!r.ok) errors[r.name] = r.error;
  }

  if (typeof deps.refreshFarms === 'function') {
    const r = await safeRun(STEPS.REFRESH_FARMS, deps.refreshFarms);
    ran.push(r.name);
    if (!r.ok) errors[r.name] = r.error;
  }

  // Invalidate any cached rendered content if the locale changed
  // or if the caller wants to force a rebuild on farm switch.
  if (typeof deps.invalidateLocalizedCaches === 'function') {
    try {
      deps.invalidateLocalizedCaches(deps.locale || null);
      ran.push(STEPS.INVALIDATE_LOCALIZED_CACHES);
    } catch (err) {
      errors[STEPS.INVALIDATE_LOCALIZED_CACHES] = err?.message || 'unknown';
    }
  }

  return Object.freeze({
    ok: Object.keys(errors).length === 0,
    ran,
    errors,
    currentFarmId: currentFarmId || null,
    intent: Object.freeze({ ...intent }),
  });
}

/**
 * summarizeIntent — turn raw change flags into an event name
 * useful for analytics. Pure.
 */
export function summarizeIntent(intent = {}) {
  const i = intent || {};
  if (i.cropSwitched)    return 'crop_switched';
  if (i.farmCreated)     return 'farm_created';
  if (i.farmSwitched)    return 'farm_switched';
  if (i.farmEdited)      return 'farm_edited';
  return 'unknown';
}
