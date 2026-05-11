/**
 * guidanceExpiry — recommendations must expire (spec §8).
 *
 *   Examples from the spec:
 *     • rain drainage check expires after rain window
 *     • watering check expires after day ends
 *     • scan follow-up expires after new scan
 *     • harvest readiness expires after listing created
 *     • funding prompt expires after clicked/dismissed
 *     • buyer prompt expires after response
 *
 * Two-tier model:
 *   1. STATIC TTL — every kind has a default lifetime (used when
 *      the caller doesn't pass explicit context).
 *   2. CONTEXTUAL — `isExpiredByContext(kind, ctx)` checks the
 *      runtime signal that made the recommendation moot (newer
 *      scan, completed task, response sent, …) and short-
 *      circuits the static window.
 */

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;

export const EXPIRY_WINDOWS: Readonly<Record<string, number>> = Object.freeze({
  weather:       4  * HOUR,    // weather windows shift fast
  task:          1  * DAY,
  scan_followup: 3  * DAY,
  soil_followup: 3  * DAY,
  funding:       30 * DAY,
  buyer:         7  * DAY,
  journal:       7  * DAY,
  progress:      14 * DAY,
  seasonal:      30 * DAY,
});

export interface ExpiryContext {
  /** ISO timestamp of the underlying signal that produced the rec. */
  readonly signalAt?: string | null;
  /** When a newer scan arrived after the rec was made. */
  readonly newerScanAt?: string | null;
  /** When the originating task was completed. */
  readonly taskCompletedAt?: string | null;
  /** When a listing was created after a harvest-readiness rec. */
  readonly listingCreatedAt?: string | null;
  /** When the user clicked/dismissed a funding prompt. */
  readonly fundingActedAt?: string | null;
  /** When the farmer responded to a buyer inquiry. */
  readonly buyerRespondedAt?: string | null;
}

function _isAfter(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = Date.parse(String(a || ''));
  const tb = Date.parse(String(b || ''));
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return ta > tb;
}

/**
 * True when the signal is past its static expiry window.
 * Returns false on missing / unparseable timestamps so callers
 * never drop a guidance just because its provenance metadata
 * was thin.
 */
export function isExpiredByWindow(
  kind: string,
  signalAtIso: string | null | undefined,
  now: number = Date.now(),
): boolean {
  const ms = EXPIRY_WINDOWS[String(kind)];
  if (!Number.isFinite(ms)) return false;
  const t = Date.parse(String(signalAtIso || ''));
  if (!Number.isFinite(t)) return false;
  return (now - t) > ms;
}

/**
 * True when the recommendation has been made moot by a newer
 * runtime signal (newer scan, completed task, sent response, …).
 * Pure / never throws.
 */
export function isExpiredByContext(kind: string, ctx: ExpiryContext = {}): boolean {
  if (!ctx) return false;
  switch (kind) {
    case 'scan_followup':
      return _isAfter(ctx.newerScanAt, ctx.signalAt)
          || _isAfter(ctx.taskCompletedAt, ctx.signalAt);
    case 'soil_followup':
      return _isAfter(ctx.taskCompletedAt, ctx.signalAt);
    case 'harvest':
    case 'harvest_sell':
      return _isAfter(ctx.listingCreatedAt, ctx.signalAt);
    case 'funding':
      return !!ctx.fundingActedAt;
    case 'buyer':
    case 'buyer_interest':
      return !!ctx.buyerRespondedAt;
    case 'task':
      return _isAfter(ctx.taskCompletedAt, ctx.signalAt);
    default:
      return false;
  }
}

/**
 * Compose both checks — true when EITHER the static window has
 * elapsed OR the runtime context made the rec moot.
 */
export function isExpired(
  kind: string,
  ctx: ExpiryContext = {},
  now: number = Date.now(),
): boolean {
  return isExpiredByWindow(kind, ctx.signalAt, now)
      || isExpiredByContext(kind, ctx);
}

/** Filter expired items out of a candidate set. */
export function dropExpired<T extends { kind: string; signalAt?: string | null }>(
  candidates: ReadonlyArray<T>,
  ctxByKind: Readonly<Record<string, ExpiryContext>> = {},
  now: number = Date.now(),
): T[] {
  if (!Array.isArray(candidates)) return [];
  return candidates.filter((c) => {
    if (!c) return false;
    const ctx = ctxByKind[String(c.kind)] || { signalAt: c.signalAt };
    return !isExpired(c.kind, ctx, now);
  });
}

export default Object.freeze({
  EXPIRY_WINDOWS,
  isExpiredByWindow,
  isExpiredByContext,
  isExpired,
  dropExpired,
});
