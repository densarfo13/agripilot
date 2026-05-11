/**
 * guidanceModeAdapter — mode-specific filtering + wording adapter.
 *
 * Garden mode must NEVER surface:
 *   • funding
 *   • sell / buyer interest
 *   • acreage
 *   • farm snapshot
 *   • land prep
 *
 * Farm mode can surface anything from the priority ladder.
 *
 * This module also routes user-facing strings through
 * `softenForGarden()` when mode === 'garden' so any farm-style
 * wording that slips in from the rule-based path lands in the
 * gardener register.
 *
 * Strict-rule audit
 *   • Pure / no I/O. Frozen exports. Never throws.
 *   • Returns null when the input would only emit a commercial
 *     surface in garden mode — caller falls through to the
 *     mode-specific fallback.
 */

import { softenForGarden } from '../../governance/emotionalToneRules.js';

export type ExperienceMode = 'farm' | 'garden';

export interface ModeAdaptable {
  readonly actionRoute?: string;
  readonly priority?: string;
  readonly kind?: string;
  readonly titleKey?: string;
  readonly messageKey?: string;
  readonly title?: string;
  readonly message?: string;
}

// Routes that are commercial-only and must be suppressed in
// garden mode. The orchestrator's priority ladder already
// down-ranks these for garden contexts via `priorityForMode`,
// but this adapter is the last-mile guard before render.
const COMMERCIAL_ROUTES = new Set<string>([
  '/funding',
  '/opportunities',
  '/sell',
  '/buy',
  '/marketplace',
  '/market/browse',
  '/buyer/interests',
  '/buyer/notifications',
  '/farmer/listings',
  '/farmer/listings/new',
]);

// Recommendation kinds that are farm-only by contract.
const COMMERCIAL_KINDS = new Set<string>([
  'funding', 'buyer', 'sell', 'harvest_sell',
]);

/**
 * Returns true when the supplied recommendation/guidance object
 * targets a commercial surface that garden mode must NOT show.
 * Pure / never throws.
 */
export function isCommercialOnly(item: ModeAdaptable | null | undefined): boolean {
  if (!item || typeof item !== 'object') return false;
  const route = String(item.actionRoute || '');
  if (COMMERCIAL_ROUTES.has(route)) return true;
  if (item.kind && COMMERCIAL_KINDS.has(String(item.kind))) return true;
  return false;
}

/**
 * Filter a candidate list by mode. Garden mode drops commercial
 * surfaces entirely; farm mode passes everything through.
 *
 *   const safe = filterByMode(candidates, 'garden');
 */
export function filterByMode<T extends ModeAdaptable>(
  candidates: ReadonlyArray<T>,
  mode: ExperienceMode | string | null | undefined,
): T[] {
  if (!Array.isArray(candidates)) return [];
  const m = String(mode || '').toLowerCase();
  if (m !== 'garden') return [...candidates];
  return candidates.filter((c) => !isCommercialOnly(c));
}

/**
 * Adapt a resolved guidance OBJECT (title + message strings) for
 * the active mode. In garden mode, runs the title + message
 * through `softenForGarden` so any farm-style wording flips to
 * the gardener register. Returns null when the guidance targets
 * a commercial route and mode is garden — caller falls through
 * to the mode-specific fallback.
 */
export function adaptGuidanceForMode<T extends ModeAdaptable & {
  title?: string; message?: string;
}>(
  guidance: T | null | undefined,
  mode: ExperienceMode | string | null | undefined,
): T | null {
  if (!guidance) return null;
  const isGarden = String(mode || '').toLowerCase() === 'garden';
  if (isGarden && isCommercialOnly(guidance)) return null;
  if (!isGarden) return guidance;

  // Garden mode — run user-facing strings through softenForGarden.
  let title = typeof guidance.title === 'string' ? guidance.title : '';
  let message = typeof guidance.message === 'string' ? guidance.message : '';
  if (title)   title = softenForGarden(title)   || title;
  if (message) message = softenForGarden(message) || message;
  return Object.freeze({ ...guidance, title, message }) as T;
}

export default Object.freeze({
  isCommercialOnly,
  filterByMode,
  adaptGuidanceForMode,
  COMMERCIAL_ROUTES,
  COMMERCIAL_KINDS,
});
