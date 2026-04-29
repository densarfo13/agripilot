/**
 * sellIntroFlag — controls a one-time "you can sell your crops
 * here" educational banner on the farmer Today screen.
 *
 * Trigger model
 *   The banner only makes sense AFTER the farmer has actually
 *   returned to the app — fresh signups don't yet need a
 *   marketplace primer. We approximate "returning user" with a
 *   localStorage visit counter that increments at most once per
 *   browser session (debounced via sessionStorage). On the 2nd
 *   recorded visit the banner becomes eligible.
 *
 *   Once the farmer dismisses (or taps Continue), the dismissed
 *   flag is sticky and the banner never appears again — even if
 *   the visit counter keeps climbing.
 *
 * Storage keys
 *   farroway:flags:sellIntroDismissed   localStorage  bool
 *   farroway:counters:todayVisits       localStorage  int
 *   farroway:session:todayVisitMarked   sessionStorage bool
 *
 * Defensive contract
 *   Every export is wrapped in try/catch. A locked-down browser
 *   (private mode, blocked storage) silently degrades to "banner
 *   never shows" — never throws into the render tree.
 */

const KEY_DISMISSED  = 'farroway:flags:sellIntroDismissed';
const KEY_VISITS     = 'farroway:counters:todayVisits';
const KEY_SESSION    = 'farroway:session:todayVisitMarked';

// Eligibility threshold: 2nd recorded visit. We pick 2 (not 1)
// so first-time onboarding stays uncluttered — the user has to
// actually come back at least once before we explain selling.
const VISIT_THRESHOLD = 2;

function _readLocal(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _writeLocal(key, val) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, val);
  } catch { /* ignore quota / private-mode */ }
}

function _readSession(key) {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  } catch { return null; }
}

function _writeSession(key, val) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, val);
  } catch { /* ignore */ }
}

/** Total recorded Today visits (lifetime, persistent). */
export function getTodayVisitCount() {
  const raw = _readLocal(KEY_VISITS);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Idempotent per browser session: increments the lifetime
 * counter at most once per tab session. Safe to call from
 * useEffect on every render — the sessionStorage guard short-
 * circuits repeat calls.
 */
export function markTodayVisit() {
  if (_readSession(KEY_SESSION)) return getTodayVisitCount();
  _writeSession(KEY_SESSION, '1');
  const next = getTodayVisitCount() + 1;
  _writeLocal(KEY_VISITS, String(next));
  return next;
}

/** True once the farmer has dismissed (or actioned) the banner. */
export function isSellIntroDismissed() {
  return _readLocal(KEY_DISMISSED) === '1';
}

/** Sticky one-way flag — never cleared by app code. */
export function dismissSellIntro() {
  _writeLocal(KEY_DISMISSED, '1');
}

/**
 * Combined predicate the banner component reads. Returns true
 * only when the farmer is a returning user AND has not yet
 * dismissed the intro.
 */
export function shouldShowSellIntro() {
  if (isSellIntroDismissed()) return false;
  return getTodayVisitCount() >= VISIT_THRESHOLD;
}
