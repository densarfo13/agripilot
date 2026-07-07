/**
 * trustScore.js — Phase 7B: lightweight deterministic trust score endpoint.
 *
 *   GET /api/v2/trust/score?farmerId=<uuid-or-device-id>
 *
 * Scoring formula (Phase 7B spec — simple, deterministic, no ML):
 *   +30  completed profile: crop set + location set (country/locationName/stateCode)
 *   +20  ≥3 completed tasks this week (CycleTaskPlan.completedAt ≥ 7d ago)
 *   +20  ≥1 accepted MarketInterest on any of the farmer's CropListings
 *   +10  recent activity: FarmProfile.updatedAt ≤ 3 days ago
 *   −20  ≥1 declined/expired MarketInterest in the last 7 days
 *   Clamped to [0, 100]
 *
 * Levels:
 *   high     ≥ 70
 *   medium   40–69
 *   low      <  40
 *
 * Response when farm profile found:
 *   { building: false, score, level, factors }
 *
 * Response when no DB record found for farmerId (offline / unregistered):
 *   { building: true, farmerId }
 *   → client shows "Building trust score…" neutral badge
 *
 * Security & privacy:
 *   • No auth required — aggregate numbers only, zero PII.
 *   • No private event log or transaction details in response.
 *   • factors object contains counts/booleans — no user data.
 *   • farmerId is echoed back verbatim; no other identifiers.
 *
 * Failure modes:
 *   • Prisma model missing / query error → that factor scores 0, others continue.
 *   • Any uncaught error → 500 → client shows neutral "Building…" badge.
 */
import express from 'express';
import prisma from '../lib/prisma.js';

const router  = express.Router();

// ── Level thresholds (Phase 7B spec) ──────────────────────────
function levelFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ─── GET /api/v2/trust/score ──────────────────────────────────
router.get('/score', async (req, res) => {
  const farmerId = typeof req.query.farmerId === 'string'
    ? req.query.farmerId.trim()
    : '';

  if (!farmerId) {
    return res.status(400).json({ error: 'farmerId is required' });
  }

  const now      = Date.now();
  const cutoff3d = new Date(now - 3 * 86_400_000);
  const cutoff7d = new Date(now - 7 * 86_400_000);

  let score    = 0;
  let building = true;   // true until we confirm a DB record exists
  const factors = {
    profileComplete:  false,
    tasksThisWeek:    0,
    approvedRequests: 0,
    recentActivity:   false,
    declinedRequests: 0,
  };

  // ── 1. Farm profile ────────────────────────────────────────
  // The listing's farmerId may be a User.id (cookie-auth, "userId"
  // in FarmProfile) or an old Farmer.id ("farmerId" in FarmProfile).
  // Try both columns; whichever matches wins.
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: {
        OR: [
          { userId: farmerId },
          { farmerId: farmerId },
        ],
        status: 'active',
      },
      select: {
        id:           true,
        crop:         true,
        country:      true,
        locationName: true,
        stateCode:    true,
        updatedAt:    true,
      },
    });

    if (farm) {
      building = false;  // confirmed: this farmer has a DB record

      // +30: crop set AND some location present.
      const hasCrop     = !!farm.crop;
      const hasLocation = !!(farm.country || farm.locationName || farm.stateCode);
      if (hasCrop && hasLocation) {
        factors.profileComplete = true;
        score += 30;
      }

      // +10: farm profile touched within the last 3 days.
      if (farm.updatedAt && new Date(farm.updatedAt) >= cutoff3d) {
        factors.recentActivity = true;
        score += 10;
      }

      // +20: ≥3 tasks completed this week via CycleTaskPlan.
      // Chain: FarmProfile.id → V2CropCycle.profileId → CycleTaskPlan.cropCycleId
      try {
        const cycles = await prisma.v2CropCycle.findMany({
          where:  { profileId: farm.id },
          select: { id: true },
        });
        const cycleIds = cycles.map((c) => c.id);

        if (cycleIds.length > 0) {
          const completedCount = await prisma.cycleTaskPlan.count({
            where: {
              cropCycleId: { in: cycleIds },
              status:      'completed',
              // completedAt may be null for tasks marked done via status only.
              // Fall back to updatedAt so we don't under-count.
              OR: [
                { completedAt: { gte: cutoff7d } },
                { completedAt: null, updatedAt: { gte: cutoff7d } },
              ],
            },
          });
          factors.tasksThisWeek = completedCount;
          if (completedCount >= 3) score += 20;
        }
      } catch { /* v2CropCycle or cycleTaskPlan may not exist → 0 */ }
    }
  } catch { /* profile not found or Prisma error → building stays true */ }

  // ── 2. Approved buyer requests: +20 for ≥1 ────────────────
  // MarketInterest.listing.farmerId → CropListing.farmerId
  try {
    const approvedCount = await prisma.marketInterest.count({
      where: {
        listing: { farmerId },
        status:  'accepted',
      },
    });
    factors.approvedRequests = approvedCount;
    if (approvedCount >= 1) score += 20;
  } catch { /* CropListing join may not exist in this env → 0 */ }

  // ── 3. Declined / expired requests last 7 days: −20 for ≥1 ─
  try {
    const declinedCount = await prisma.marketInterest.count({
      where: {
        listing:   { farmerId },
        status:    { in: ['declined', 'expired'] },
        updatedAt: { gte: cutoff7d },
      },
    });
    factors.declinedRequests = declinedCount;
    if (declinedCount >= 1) score -= 20;
  } catch { /* same safe fallback */ }

  // Clamp to [0, 100].
  score = Math.min(100, Math.max(0, score));

  // Offline / unregistered farmer — return building state.
  if (building) {
    return res.json({ building: true, farmerId });
  }

  return res.json({
    building: false,
    score,
    level:   levelFromScore(score),
    factors,
    farmerId,
  });
});

export default router;
