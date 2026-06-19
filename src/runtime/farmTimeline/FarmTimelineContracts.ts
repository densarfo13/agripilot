/**
 * FarmTimelineContracts.ts — sprint #212 §7.
 *
 * Types for the Activity-page farm journey timeline. The engine wraps
 * the #209 FarmTimeline composite (read-only over existing events) and
 * adds the Activity-facing empty-story shape.
 */

export const FARM_TIMELINE_CONTRACTS_VERSION = 'farm-timeline-contracts-v1';

// The 10 tracked journey kinds (the #209 set + harvest/sell drafts).
export const FARM_JOURNEY_KINDS = Object.freeze([
  'farm_created', 'location_added', 'crop_added', 'planting_date_added',
  'scan_completed', 'issue_detected', 'task_completed', 'outcome_recorded',
  'harvest_draft_created', 'sell_listing_created',
] as const);
export type FarmJourneyKind = (typeof FARM_JOURNEY_KINDS)[number];

export interface FarmJourneyView {
  runtimeVersion: string;
  entries:        ReadonlyArray<Readonly<{ kind: string; label: string; at: string; detail: string | null }>>;
  count:          number;
  active:         boolean;
  // Empty-state guidance (never a dead "No activity yet").
  storyKey:       string;
  ctaKey:         string;
  ctaRoute:       string;
}
