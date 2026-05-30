/**
 * src/runtime/buyerTrust/buyerTrustContracts.ts — Frozen
 * contracts for the Farroway Buyer Trust Signals v1 runtime.
 *
 *   import {
 *     BUYER_TRUST_RUNTIME_VERSION,
 *     BUYER_TRUST_BADGE,
 *     TRUST_STORAGE_KEYS,
 *     ACTIVE_GROWER_WINDOW_DAYS,
 *     type TrustSignal, type TrustBadge,
 *   } from 'src/runtime/buyerTrust/buyerTrustContracts';
 *
 * What this is
 * ────────────
 *   Pure constants + TypeScript types. The runtime + UI read
 *   these to know the badge enum, the storage keys composed
 *   from existing stores, and the canonical "active grower"
 *   window in days. Frozen at module load.
 *
 * Strict-rule audit
 *   • Pure data, no side effects, no imports of engines.
 *   • No PII fields — opaque growerRef only, no farmer name /
 *     phone / email / coords / device id / IP.
 *   • SSR-safe. Never throws.
 */

export const BUYER_TRUST_RUNTIME_VERSION = 'buyer-trust-v1';

/**
 * Badge enum. Values match what UI components key off.
 *   • active_grower   — derived from recent scan activity.
 *   • verified_grower — reserved future slot, always false
 *                       in v1. The envelope still surfaces it
 *                       so the buyer card can paint the slot.
 */
export const BUYER_TRUST_BADGE = Object.freeze({
  ACTIVE_GROWER:   'active_grower',
  VERIFIED_GROWER: 'verified_grower',
});
export type TrustBadge =
  (typeof BUYER_TRUST_BADGE)[keyof typeof BUYER_TRUST_BADGE];

/**
 * Canonical localStorage keys this runtime READS (never writes).
 * Composition only — these stores are owned by other modules:
 *   • SCAN_HISTORY     — src/lib/scan/scanHistoryStore.js
 *   • MANAGED_PLANTS   — src/data/managedPlantsStore.js
 */
export const TRUST_STORAGE_KEYS = Object.freeze({
  SCAN_HISTORY:   'farroway_scan_history_v1',
  MANAGED_PLANTS: 'farroway_managed_plants',
});

/**
 * "Active grower" rolling window — at least one scan in the
 * last N days flips activeGrowerBadge true. 14 days per spec.
 */
export const ACTIVE_GROWER_WINDOW_DAYS = 14;

/**
 * TrustSignal — the frozen envelope shape returned by
 * BuyerTrustRuntime.getTrustSignals(). All fields are optional
 * at the type level so callers can safely read a fallback
 * envelope without runtime errors.
 *
 *   lastScanDate           — ISO timestamp of the most recent
 *                            scan, or null when no scans found.
 *   recentPlantPhoto       — URL / data-ref of the most recent
 *                            managed plant's photo, or null.
 *   activeGrowerBadge      — true when >=1 scan in the last
 *                            ACTIVE_GROWER_WINDOW_DAYS days.
 *   verifiedGrowerBadge    — reserved; false in v1.
 *   verifiedBadgeReserved  — always true; signals to the UI
 *                            that the slot exists and may be
 *                            rendered (greyed/locked).
 *   runtimeVersion         — pinned to BUYER_TRUST_RUNTIME_VERSION.
 *   ready                  — true on the happy path, false on
 *                            the frozen-fallback envelope.
 */
export interface TrustSignal {
  readonly runtimeVersion:        string;
  readonly ready:                 boolean;
  readonly lastScanDate:          string | null;
  readonly recentPlantPhoto:      string | null;
  readonly activeGrowerBadge:     boolean;
  readonly verifiedGrowerBadge:   boolean;
  readonly verifiedBadgeReserved: boolean;
}
