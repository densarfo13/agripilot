/**
 * scanLimitGuard.js — per-user daily scan quota guard for the
 * Smart Scan AI Backend spec §7.
 *
 *   const result = await checkDailyScanLimit({ prisma, userId, isPro });
 *   if (!result.ok) {
 *     return res.status(429).json({
 *       error: 'scan_limit_reached',
 *       limit: result.limit,
 *       used:  result.used,
 *       resetAt: result.resetAt,
 *     });
 *   }
 *
 * Why a per-user counter rather than the existing scanLimiter
 * ──────────────────────────────────────────────────────────
 *   The existing `scanLimiter` in app.js is per-IP, per-minute.
 *   That's the right shape for abuse prevention. The spec calls
 *   for a per-USER, per-DAY quota tied to billing tier — which
 *   is a cost-control concern, not abuse-prevention. Both
 *   coexist; this guard runs AFTER the IP limiter passes.
 *
 * Storage strategy
 *   Counts the existing `scanTrainingEvent` rows for the user
 *   over the current calendar day (server-local UTC, since
 *   user timezone isn't reliably available server-side).
 *   No new tables; the row that's already written by the
 *   /api/scan/analyze success path IS the counter.
 *
 * Strict-rule audit
 *   • Never throws — Prisma errors collapse to "ok: true"
 *     (fail-open) because a counter outage shouldn't block
 *     paying users.
 *   • Anonymous users (userId null) are NOT counted — the IP
 *     limiter is the relevant gate for them.
 *   • Pro users always pass — the `isPro` flag short-circuits
 *     the count.
 */

// Spec §7 — Free: 3 scans/day. Pro: higher limit.
// FREE_DAILY_LIMIT is the hard cap; PRO_DAILY_LIMIT is a
// generous ceiling that still blocks runaway-cost edge cases
// (a Pro user accidentally polling the endpoint in a tight loop).
const FREE_DAILY_LIMIT = 3;
const PRO_DAILY_LIMIT  = 50;

function _startOfDayUtc(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function _endOfDayUtc(now = new Date()) {
  const d = _startOfDayUtc(now);
  return new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * checkDailyScanLimit — main entry. Returns:
 *   { ok: true,  limit, used, remaining, resetAt }    when allowed
 *   { ok: false, limit, used, remaining: 0, resetAt } when over quota
 *
 * Anonymous (no userId) → ok: true, never blocks. The IP-based
 * scanLimiter is the relevant gate for those callers.
 */
export async function checkDailyScanLimit({
  prisma, userId, isPro = false, now = new Date(),
} = {}) {
  // No user → fail-open. The IP limiter is the gate.
  if (!userId || !prisma || !prisma.scanTrainingEvent) {
    return {
      ok: true,
      limit: isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT,
      used: 0,
      remaining: isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT,
      resetAt: _endOfDayUtc(now).toISOString(),
    };
  }

  const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  let used = 0;
  try {
    used = await prisma.scanTrainingEvent.count({
      where: {
        userId: String(userId),
        createdAt: {
          gte: _startOfDayUtc(now),
          lte: _endOfDayUtc(now),
        },
      },
    });
  } catch {
    // Counter outage — fail-open per the strict-rule audit.
    used = 0;
  }

  const remaining = Math.max(0, limit - used);
  const ok = used < limit;
  return Object.freeze({
    ok,
    limit,
    used,
    remaining,
    resetAt: _endOfDayUtc(now).toISOString(),
  });
}

export const _internal = Object.freeze({
  FREE_DAILY_LIMIT, PRO_DAILY_LIMIT,
  _startOfDayUtc, _endOfDayUtc,
});

export default { checkDailyScanLimit };
