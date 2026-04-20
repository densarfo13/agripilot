/**
 * riskYieldBanners.js — §5 farmer-side integration. Convert a
 * risk level + yield estimate into LocalizedPayload banners the
 * farmer dashboard can render through renderLocalizedMessage.
 *
 * Pure. No React. No strings — only keys + params + fallback.
 * Caller decides whether to display.
 *
 *   buildFarmerAlertBanners({ risk, yield, completedToday? })
 *     → [ LocalizedPayload, ... ]
 *
 * Rules (from spec §5):
 *   • risk.level === 'high' → "High risk detected. Review tasks today."
 *   • yield dropped (estimated < 80% of baseline) → "Expected yield reduced due to conditions"
 *
 * Output order: high-risk first, then yield — matches the
 * urgency the farmer should act on first.
 */

// Mirrors src/core/i18n/localizedPayload.makeLocalizedPayload —
// duplicated here as a pure helper so this module has no
// runtime dependency on core/i18n. Keeps the farmer bundle
// tree-shakeable and the module testable in isolation.
function payload(key, params = {}, extra = {}) {
  return Object.freeze({ key, params: params || {}, ...extra });
}

/**
 * yieldDropPercent — returns a 0..100 number describing how
 * far below baseline the estimate has fallen. Never negative.
 */
export function yieldDropPercent(estimate, baseline) {
  if (!Number.isFinite(estimate) || !Number.isFinite(baseline) || baseline <= 0) return 0;
  if (estimate >= baseline) return 0;
  const drop = ((baseline - estimate) / baseline) * 100;
  return Math.max(0, Math.min(100, Math.round(drop)));
}

/**
 * buildFarmerAlertBanners — main entry. `yield` here is the
 * engine's frozen result shape: { estimated, baseline, ... }.
 * A plain number is also accepted for spec compatibility.
 */
export function buildFarmerAlertBanners({
  risk = null, yield: yieldEstimate = null, completedToday = false,
} = {}) {
  const banners = [];

  // ── HIGH RISK BANNER ────────────────────────────────
  const riskLevel = risk?.level || (typeof risk === 'string' ? risk : null);
  if (riskLevel === 'high') {
    banners.push(payload(
      'farmer.banner.high_risk',
      { reasons: risk?.reasons || [] },
      {
        severity: 'critical',
        fallback: 'High risk detected. Review tasks today.',
        variant:  'risk',
      },
    ));
  }

  // ── YIELD-REDUCED BANNER ────────────────────────────
  // Accepts the full engine result or a plain number. When we
  // have the richer shape, check drop vs. baseline.
  let reduced = false;
  let dropPct = 0;
  if (yieldEstimate && typeof yieldEstimate === 'object'
      && Number.isFinite(yieldEstimate.estimated)
      && Number.isFinite(yieldEstimate.baseline)) {
    dropPct = yieldDropPercent(yieldEstimate.estimated, yieldEstimate.baseline);
    reduced = dropPct >= 20;
  } else if (typeof yieldEstimate === 'number') {
    // Plain number — no baseline context. Threshold from spec
    // default baseline of 100 means any estimate < 80 is a drop.
    if (yieldEstimate < 80) {
      reduced = true;
      dropPct = Math.max(0, Math.min(100, Math.round(100 - yieldEstimate)));
    }
  }
  if (reduced) {
    banners.push(payload(
      'farmer.banner.yield_reduced',
      { dropPct },
      {
        severity: 'warning',
        fallback: 'Expected yield reduced due to conditions',
        variant:  'yield',
      },
    ));
  }

  // ── LOW-COMPLETION POSITIVE NUDGE ───────────────────
  // Not in the original spec §5 but a coherent extension:
  // if risk is medium AND the farmer has already completed
  // today, show a calming confirmation rather than a warning.
  if (riskLevel === 'medium' && completedToday) {
    banners.push(payload(
      'farmer.banner.on_track',
      {},
      {
        severity: 'positive',
        fallback: 'You\u2019re on track — keep going.',
        variant:  'nudge',
      },
    ));
  }

  return banners;
}
