/**
 * farmerCohortEngine.js — cohorts the NGO admin can act on.
 *
 *   import { buildFarmerCohorts, COHORT }
 *     from 'src/core/ngo/farmerCohortEngine.js';
 *
 *   const c = buildFarmerCohorts({ farmers: [...], nowMs: Date.now() });
 *   // c.active / c.inactive / c.newcomers / c.atRisk / c.harvestSoon
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Splits the cohort list the operator hands in into actionable
 *   buckets. Each bucket is just a list of farmer ids — no PII
 *   leaves the engine. The admin surface joins ids back to the
 *   farmer rows under its own RBAC.
 *
 *   It is NOT a learning system. It does NOT make outreach
 *   decisions on its own. It just returns the buckets — the
 *   admin decides what to do.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const COHORT = Object.freeze({
  ACTIVE:        'active',
  INACTIVE:      'inactive',
  NEWCOMERS:     'newcomers',
  AT_RISK:       'at_risk',
  HARVEST_SOON:  'harvest_soon',
});

const _DAY = 86400000;

/**
 * @param {object} ctx
 * @returns {object}
 */
export function buildFarmerCohorts(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
    const farmers = Array.isArray(c.farmers) ? c.farmers : [];

    const inactiveDays = Number.isFinite(c.inactiveDaysThreshold) ? c.inactiveDaysThreshold : 14;
    const newcomerDays = Number.isFinite(c.newcomerDaysThreshold) ? c.newcomerDaysThreshold : 7;
    const harvestSoonDays = Number.isFinite(c.harvestSoonDaysThreshold) ? c.harvestSoonDaysThreshold : 14;

    const inactiveCutoff = nowMs - inactiveDays * _DAY;
    const newcomerCutoff = nowMs - newcomerDays * _DAY;
    const harvestSoonCutoff = nowMs + harvestSoonDays * _DAY;

    const active = [];
    const inactive = [];
    const newcomers = [];
    const atRisk = [];
    const harvestSoon = [];

    for (const f of farmers) {
      if (!f || typeof f !== 'object' || !f.id) continue;
      const id = String(f.id);
      const lastActive = Number(f.lastActiveAt);
      const createdAt  = Number(f.createdAt);
      const harvestAt  = Number(f.estimatedHarvestAt);
      const hasRecentRisk = Array.isArray(f.recentRisks) && f.recentRisks.length > 0;
      const taskRate = Number(f.taskCompletionRate);

      if (Number.isFinite(lastActive) && lastActive >= inactiveCutoff) active.push(id);
      else inactive.push(id);

      if (Number.isFinite(createdAt) && createdAt >= newcomerCutoff) newcomers.push(id);

      // At-risk = any recent risk OR very low task completion AND active.
      if (hasRecentRisk || (Number.isFinite(taskRate) && taskRate <= 0.3
                            && Number.isFinite(lastActive) && lastActive >= inactiveCutoff)) {
        atRisk.push(id);
      }

      if (Number.isFinite(harvestAt) && harvestAt > nowMs && harvestAt <= harvestSoonCutoff) {
        harvestSoon.push(id);
      }
    }

    return {
      ok:           true,
      cohorts: {
        [COHORT.ACTIVE]:       active,
        [COHORT.INACTIVE]:     inactive,
        [COHORT.NEWCOMERS]:    newcomers,
        [COHORT.AT_RISK]:      atRisk,
        [COHORT.HARVEST_SOON]: harvestSoon,
      },
      counts: {
        [COHORT.ACTIVE]:       active.length,
        [COHORT.INACTIVE]:     inactive.length,
        [COHORT.NEWCOMERS]:    newcomers.length,
        [COHORT.AT_RISK]:      atRisk.length,
        [COHORT.HARVEST_SOON]: harvestSoon.length,
      },
      generatedAt: nowMs,
      disclaimer:  { key: 'ngo.cohort.disclaimer',
                     fallback: 'Cohorts are based on the last 14 days of activity. Outreach decisions stay with the operator.' },
    };
  } catch {
    return {
      ok: false,
      cohorts: { active: [], inactive: [], newcomers: [], at_risk: [], harvest_soon: [] },
      counts:  { active: 0, inactive: 0, newcomers: 0, at_risk: 0, harvest_soon: 0 },
      generatedAt: Date.now(),
      disclaimer: { key: 'ngo.cohort.disclaimer',
                    fallback: 'Cohorts unavailable for this run.' },
    };
  }
}

const _module = { COHORT, buildFarmerCohorts };
export default _module;
