/**
 * scanLimitGuard.js — per-user daily scan quota guard for the Smart Scan
 * AI Backend spec §7, PLAN-AWARE.
 *
 *   const q = await checkDailyScanLimit({ prisma, user: req.user });
 *   if (!q.ok) return res.status(429).json({ error:'scan_limit_reached', ...q });
 *
 * Runs BEFORE any image preprocess / provider call, so a blocked request
 * never touches Plant.id / Kindwise, never spends a provider credit, and
 * never writes scan history / tasks / review rows (the guard returns first).
 *
 * Plans → env-configurable daily limits (spec defaults):
 *   guest    1   SCAN_GUEST_DAILY_LIMIT
 *   free     3   SCAN_FREE_DAILY_LIMIT
 *   pilot    50  SCAN_PILOT_DAILY_LIMIT
 *   premium  100 SCAN_PREMIUM_DAILY_LIMIT
 *   admin    200 SCAN_ADMIN_DAILY_LIMIT
 *
 * Plan is resolved from the EXISTING user model — the `role` enum plus any
 * premium/pilot signal already on the user record — NOT a new entitlement
 * system and NOT a hardcoded user id. Operator allowlists
 * (SCAN_PILOT_USER_IDS / SCAN_PREMIUM_USER_IDS, comma-separated) let a
 * specific tester be opted into a plan via config, not code.
 *
 * Storage: counts the existing `scanTrainingEvent` rows for the user over
 * the current UTC day. No new tables.
 *
 * Strict-rule audit
 *   • Never throws — Prisma errors collapse to ok:true (fail-open) so a
 *     counter outage never blocks a paying user.
 *   • Anonymous (no user id) → ok:true; the IP-based scanLimiter is the
 *     relevant gate for those callers (per-IP daily counting is not done
 *     here — this guard is per-USER).
 */

// Read a positive integer from env, else the default.
function _dailyLimit(name, dflt) {
  try {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt;
  } catch { return dflt; }
}

// Plan → { env var, default daily limit }.
const PLAN_DEFAULTS = Object.freeze({
  guest:   { env: 'SCAN_GUEST_DAILY_LIMIT',   dflt: 1 },
  free:    { env: 'SCAN_FREE_DAILY_LIMIT',    dflt: 3 },
  pilot:   { env: 'SCAN_PILOT_DAILY_LIMIT',   dflt: 50 },
  premium: { env: 'SCAN_PREMIUM_DAILY_LIMIT', dflt: 100 },
  admin:   { env: 'SCAN_ADMIN_DAILY_LIMIT',   dflt: 200 },
});

function _limitForPlan(plan) {
  const p = PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.free;
  return _dailyLimit(p.env, p.dflt);
}

// Comma-separated env allowlist membership (operator config, not a
// hardcoded id) — lets a specific tester be opted into a plan.
function _idInEnvList(name, id) {
  try {
    if (!id) return false;
    const raw = process.env[name];
    if (!raw) return false;
    return String(raw).split(',').map((s) => s.trim()).filter(Boolean)
      .includes(String(id));
  } catch { return false; }
}

/**
 * Resolve the caller's scan plan from the existing user model. Precedence:
 * admin (role) > premium (signal/allowlist) > pilot (signal/allowlist) >
 * free; no user → guest. Never throws; unknown → 'free' (conservative).
 *
 * @param {object|null} user  req.user (or { id, role, ... })
 * @returns {'guest'|'free'|'pilot'|'premium'|'admin'}
 */
export function resolveScanPlan(user) {
  try {
    const id = user && (user.id || user.sub);
    if (!user || !id) return 'guest';
    const role = String(user.role || '').toLowerCase();
    if (role === 'super_admin' || role === 'admin') return 'admin';
    if (user.isPremium === true || user.plan === 'premium'
        || user.isPro === true || user.proStatus === 'active'
        || _idInEnvList('SCAN_PREMIUM_USER_IDS', id)) return 'premium';
    if (user.plan === 'pilot' || user.isPilot === true
        || _idInEnvList('SCAN_PILOT_USER_IDS', id)) return 'pilot';
    return 'free';
  } catch { return 'free'; }
}

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
 * checkDailyScanLimit — main entry. Returns accurate quota metadata:
 *   { ok, limit, used, remaining, resetsAt, plan }   (resetAt kept as alias)
 *
 * Accepts a full `user` object (preferred — enables plan resolution) or a
 * bare `userId` (+ optional isPro) for back-compat.
 */
export async function checkDailyScanLimit({
  prisma, user, userId, isPro = false, now = new Date(),
} = {}) {
  const _user = user || (userId ? { id: userId, isPro } : null);
  const plan = resolveScanPlan(_user);
  const limit = _limitForPlan(plan);
  const resetsAt = _endOfDayUtc(now).toISOString();
  const id = _user && (_user.id || _user.sub);

  // No user id → cannot count per-user rows; fail-open. The IP limiter is
  // the gate for anonymous callers.
  if (!id || !prisma || !prisma.scanTrainingEvent) {
    return Object.freeze({
      ok: true, limit, used: 0, remaining: limit, resetsAt, resetAt: resetsAt, plan,
    });
  }

  let used = 0;
  try {
    used = await prisma.scanTrainingEvent.count({
      where: {
        userId: String(id),
        createdAt: { gte: _startOfDayUtc(now), lte: _endOfDayUtc(now) },
      },
    });
  } catch {
    used = 0; // counter outage — fail-open
  }

  const remaining = Math.max(0, limit - used);
  const ok = used < limit;
  return Object.freeze({
    ok, limit, used, remaining, resetsAt, resetAt: resetsAt, plan,
  });
}

export const _internal = Object.freeze({
  PLAN_DEFAULTS, _limitForPlan, _idInEnvList, resolveScanPlan,
  _startOfDayUtc, _endOfDayUtc,
  // Legacy default references (kept for back-compat with older callers).
  FREE_DAILY_LIMIT: PLAN_DEFAULTS.free.dflt,
  PRO_DAILY_LIMIT:  PLAN_DEFAULTS.premium.dflt,
});

export default { checkDailyScanLimit, resolveScanPlan };
