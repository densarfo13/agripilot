/**
 * journeyRouter.js — pure decision helper that turns a journey
 * state into the best in-app route for that farmer.
 *
 *   getRouteForState(state) → string
 *
 * Uses the existing Farroway routes so nothing new has to be
 * registered:
 *
 *   onboarding      → /onboarding/fast
 *   crop_selected   → /crop-fit/quick
 *   planning        → /today
 *   active_farming  → /today
 *   harvest         → /today         (harvest modal lives there)
 *   post_harvest    → /dashboard
 *
 * A caller can plug this into its own redirect logic (e.g. a root-
 * layout effect) without every page needing to know about the
 * journey state directly.
 */

const ROUTES = Object.freeze({
  onboarding:     '/onboarding/fast',
  crop_selected:  '/crop-fit/quick',
  planning:       '/today',
  active_farming: '/today',
  harvest:        '/today',
  post_harvest:   '/dashboard',
});

const DEFAULT_ROUTE = '/today';

export function getRouteForState(state) {
  if (!state) return DEFAULT_ROUTE;
  return ROUTES[state] || DEFAULT_ROUTE;
}

/**
 * shouldRedirect — returns `{ redirect, to }` the caller can use
 * inside a layout effect. Only returns `true` when the current URL
 * clearly doesn't match the farmer's journey (e.g. lands on /
 * while still in onboarding). Safe when `currentPath` is any
 * authenticated app path.
 */
export function shouldRedirect(state, currentPath) {
  const target = getRouteForState(state);
  if (!currentPath || typeof currentPath !== 'string') {
    return { redirect: true, to: target };
  }
  const normalizedCurrent = currentPath.split('?')[0].replace(/\/$/, '');
  // Root + welcome + login land-pages always redirect into the journey.
  const ROOT_PATHS = new Set(['', '/', '/welcome', '/farmer-welcome', '/start']);
  if (ROOT_PATHS.has(normalizedCurrent)) return { redirect: true, to: target };
  return { redirect: false, to: target };
}

export const _routes = ROUTES;
