/**
 * locationRetryPolicy — pure policy for acquiring a GPS fix reliably.
 *
 * The bug it fixes (priority #2 location detection): getCurrentPosition made ONE attempt
 * with enableHighAccuracy. High-accuracy GPS frequently TIMES OUT or is UNAVAILABLE indoors
 * / on weak signal (exactly where a farmer often opens the app), turning a recoverable
 * condition into a hard failure. This plans a second, balanced-accuracy attempt and decides
 * when a retry can actually help — never re-attempting a permission denial (which won't
 * change) and never blocking onboarding.
 *
 * Pure. Never throws.
 */

/** Acceptable accuracy for treating a fix as precise (PHASE 7). A wider fix is still usable
 *  for region/weather, so this is a non-blocking QUALITY signal, not a hard reject. */
export const ACCURACY_THRESHOLD_M = 100;

export interface AttemptOptions {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

/** Attempt 1: precise GPS. Attempt 2 (retry): balanced/network — faster, tolerates weak GPS. */
export const LOCATION_ATTEMPTS: ReadonlyArray<AttemptOptions> = Object.freeze([
  Object.freeze({ enableHighAccuracy: true,  timeout: 15000, maximumAge: 30000 }),
  Object.freeze({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }),
]);

/** Normalize a GPS_ERROR string or a native numeric code to the string code. */
function _code(code: any): string {
  if (typeof code === 'string') return code.toLowerCase();
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  if (code === 1) return 'access_denied';
  return '';
}

/**
 * Should we retry after a failed attempt? Only when a different attempt could plausibly
 * succeed — a timeout or position-unavailable can be helped by a balanced/network attempt.
 * A permission denial, an unsupported browser, or an insecure context will NOT change on
 * retry, so we don't waste the farmer's time (or re-prompt).
 */
export function shouldRetry(errorCode: any): boolean {
  const c = _code(errorCode);
  return c === 'timeout' || c === 'unavailable';
}

/** The options for a given 0-based attempt index, clamped to the last plan. */
export function attemptOptions(index: number): AttemptOptions {
  const i = Number.isFinite(index) && index > 0 ? Math.min(index, LOCATION_ATTEMPTS.length - 1) : 0;
  return LOCATION_ATTEMPTS[i];
}

export type AccuracyVerdict = 'ok' | 'low' | 'unknown';

/** Classify a fix's accuracy (metres). Non-blocking — the caller still uses a 'low' fix. */
export function accuracyVerdict(accuracyM: any, threshold: number = ACCURACY_THRESHOLD_M): AccuracyVerdict {
  if (typeof accuracyM !== 'number' || !Number.isFinite(accuracyM) || accuracyM < 0) return 'unknown';
  return accuracyM <= threshold ? 'ok' : 'low';
}
