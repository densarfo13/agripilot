/**
 * verification — feature-flag-gated foundation for the trust /
 * verification scoring layer.
 *
 *   Feature flag: enableVerificationEngine (alias: enableScoringEngine)
 *
 * Behaviour
 *   • Flag OFF: every export returns 'building_trust_history'
 *     for everyone. The user-facing badge stays neutral; no
 *     scary "fraud score" / "low trust" labels ever appear.
 *   • Flag ON: the layer can compute richer trust signals from
 *     activity / scan-consistency / harvest-verification.
 *
 * Output contract (spec §8 + §11)
 *   The ONLY user-visible badges are:
 *     'verified'                — explicitly checked source
 *     'needs_review'            — soft flag, action available
 *     'building_trust_history'  — default neutral state
 *   No percentages. No raw scores. No "fraud risk".
 */

import { isFeatureEnabled } from '../../config/features.js';

const FLAGS = ['enableVerificationEngine', 'enableScoringEngine'];

export type TrustBadge =
  | 'verified'
  | 'needs_review'
  | 'building_trust_history';

export interface TrustSignals {
  /** Activity-level signal — internal only. */
  readonly hasRecentActivity?: boolean;
  /** Scan-consistency signal — internal only. */
  readonly scanCount?: number;
  /** Harvest-verification signal — internal only. */
  readonly verifiedHarvests?: number;
  /** Funding-disclosure signal — internal only. */
  readonly fundingDisclosures?: number;
}

export function isVerificationEnabled(): boolean {
  try {
    for (const f of FLAGS) if (isFeatureEnabled(f)) return true;
  } catch { /* swallow */ }
  return false;
}

/**
 * Compute the user-facing badge from internal trust signals.
 * Conservative — the default neutral badge wins on any
 * ambiguity. Pure / never throws.
 */
export function computeTrustBadge(signals: TrustSignals | null | undefined): TrustBadge {
  if (!isVerificationEnabled()) return 'building_trust_history';
  const safe = (signals && typeof signals === 'object') ? signals : {};
  // Verified: explicit harvest + scan + activity signals all met.
  if ((safe.verifiedHarvests ?? 0) >= 2
      && (safe.scanCount ?? 0) >= 3
      && safe.hasRecentActivity === true) {
    return 'verified';
  }
  // Needs review: explicit caller flag (e.g. funding URL flagged).
  if (safe.fundingDisclosures === -1) return 'needs_review';
  return 'building_trust_history';
}

/** Convenience — human-readable label for the badge. */
export function describeTrustBadge(badge: TrustBadge): string {
  switch (badge) {
    case 'verified':              return 'Verified';
    case 'needs_review':          return 'Needs review';
    case 'building_trust_history':
    default:                       return 'Building trust history';
  }
}

export default Object.freeze({
  isVerificationEnabled,
  computeTrustBadge,
  describeTrustBadge,
});
