/**
 * getPrimaryGuidance — single entry point every page binds to.
 *
 *   import { getPrimaryGuidance } from
 *     'src/intelligence/recommendations/getPrimaryGuidance';
 *
 *   const guidance = getPrimaryGuidance({
 *     mode, country, region, weather, timeOfDay, season,
 *     cropOrPlant, growthStage, recentTasks, recentScans,
 *     soilChecks, activeListing, buyerInterest, fundingMatches,
 *     lastRecommendation, userActivity, offlineStatus,
 *   });
 *
 *   if (guidance) render(<Tile {...guidance} />);
 *
 * Pipeline
 *   1. Build the orchestrator context from the supplied input.
 *   2. Call getNextBestRecommendation → returns one envelope.
 *   3. Adapt the envelope for the active mode (drop commercial
 *      surfaces in garden mode; soften wording).
 *   4. Map to the spec's PrimaryGuidance shape (title / message /
 *      tone / confidenceTone — never scores or percentages).
 *   5. Fall through to the mode-specific fallback on any miss.
 *
 * Strict-rule audit
 *   • Pure / never throws. Returns the fallback envelope on any
 *     internal error.
 *   • Never exposes the orchestrator's i18n keys directly to the
 *     caller — those are resolved via tSafe at the surface layer.
 *     Title / message strings in PrimaryGuidance come back as the
 *     i18n KEY strings; the rendering component is expected to
 *     wrap them in tSafe(). The existing Home bottom tile
 *     does exactly that.
 */

import {
  getNextBestRecommendation,
  FALLBACK_RECOMMENDATION,
} from '../../orchestration/orchestrator.js';
import { adaptGuidanceForMode } from './guidanceModeAdapter.js';
import { fallbackForMode } from './fallbacks.js';

export type ExperienceMode = 'farm' | 'garden';
export type GuidanceTone = 'calm' | 'reassuring' | 'practical';
export type ConfidenceTone = 'clear' | 'needs-check' | 'limited-data';

export interface GuidanceContext {
  readonly mode?: ExperienceMode | string;
  readonly country?: string;
  readonly region?: string;
  readonly weather?: object | null;
  readonly timeOfDay?: 'morning' | 'afternoon' | 'evening' | string;
  readonly season?: string;
  readonly cropOrPlant?: string;
  readonly crop?: string;
  readonly plantName?: string;
  readonly growthStage?: string;
  readonly cropStage?: string;
  readonly recentTasks?: ReadonlyArray<unknown>;
  readonly tasks?: ReadonlyArray<unknown>;
  readonly recentScans?: ReadonlyArray<unknown>;
  readonly scanHistory?: ReadonlyArray<unknown>;
  readonly soilChecks?: ReadonlyArray<unknown>;
  readonly activeListing?: object | null;
  readonly produceListings?: ReadonlyArray<unknown>;
  readonly buyerInterest?: ReadonlyArray<unknown> | object | null;
  readonly fundingMatches?: ReadonlyArray<unknown>;
  readonly lastRecommendation?: { id?: string; shownAt?: string } | null;
  readonly userActivity?: object | null;
  readonly offlineStatus?: boolean;
  readonly farmSize?: number;
}

export interface GuidanceOptions {
  readonly now?: number;
  /** When false the orchestrator does NOT stamp memory cooldowns. */
  readonly commit?: boolean;
}

export interface PrimaryGuidance {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly reason: string;
  readonly actionLabel: string;
  readonly actionRoute: string;
  readonly estimatedMinutes: number;
  readonly tone: GuidanceTone;
  readonly confidenceTone: ConfidenceTone;
  readonly priority: string;
  readonly expiresAt: string | null;
}

function _toGuidance(env: Record<string, unknown>, mode: string): PrimaryGuidance {
  const tier = String(env.confidence || '').toLowerCase();
  const confidenceTone: ConfidenceTone =
    tier === 'high'   ? 'clear'
  : tier === 'medium' ? 'needs-check'
  :                     'limited-data';
  const urgency = String(env.urgency || '').toLowerCase();
  const tone: GuidanceTone =
    urgency === 'high'   ? 'practical'
  : urgency === 'medium' ? 'reassuring'
  :                        'calm';
  return Object.freeze({
    id:               `rec_${String(env.titleKey || 'fallback')}_${tier || 'low'}`,
    title:            String(env.titleKey       || ''),
    message:          String(env.messageKey     || ''),
    reason:           String(env.reasonKey      || ''),
    actionLabel:      String(env.actionLabelKey || ''),
    actionRoute:      String(env.actionRoute    || '/tasks'),
    estimatedMinutes: Number.isFinite(env.estimatedMinutes as number)
                        ? Number(env.estimatedMinutes) : 2,
    tone,
    confidenceTone,
    priority:         String(env.priority || 'normal'),
    expiresAt:        null,
  });
}

/**
 * The headline API. Returns ONE primary guidance per call.
 * Never throws — returns the mode-specific fallback on any
 * error or commercial-surface-in-garden suppression.
 */
export function getPrimaryGuidance(
  ctx: GuidanceContext | null | undefined,
  opts: GuidanceOptions = {},
): PrimaryGuidance {
  const safe = (ctx && typeof ctx === 'object') ? ctx : ({} as GuidanceContext);
  const mode = String(safe.mode || 'farm').toLowerCase() === 'garden' ? 'garden' : 'farm';

  let env;
  try {
    env = getNextBestRecommendation({
      mode,
      country:        safe.country,
      region:         safe.region,
      weather:        safe.weather,
      crop:           safe.crop || safe.cropOrPlant || safe.plantName,
      cropStage:      safe.cropStage || safe.growthStage,
      farmSize:       safe.farmSize,
      scanHistory:    safe.recentScans   || safe.scanHistory,
      soilChecks:     safe.soilChecks,
      tasks:          safe.recentTasks   || safe.tasks,
      produceListings: safe.produceListings || (safe.activeListing ? [safe.activeListing] : undefined),
      buyerInterest:  Array.isArray(safe.buyerInterest)
                        ? safe.buyerInterest
                        : (safe.buyerInterest ? [safe.buyerInterest] : undefined),
      fundingMatches: safe.fundingMatches,
    } as never, {
      now:     opts.now,
      commit:  opts.commit !== false,
    } as never);
  } catch {
    return fallbackForMode(mode);
  }

  // When the orchestrator ladder missed every rung it hands back
  // the generic FALLBACK_RECOMMENDATION whose titleKey is the
  // i18n key 'home.goodQuickCheck'. The spec §11 contract is that
  // the page-facing primary guidance use the calm, mode-specific
  // wording in this case (so the user reads a useful nudge, not
  // an unresolved key). Detect and substitute here.
  const e = (env || FALLBACK_RECOMMENDATION) as { titleKey?: string };
  if (!env || e.titleKey === FALLBACK_RECOMMENDATION.titleKey) {
    return fallbackForMode(mode);
  }

  const guidance = _toGuidance(e as never, mode);
  // Apply mode adapter — drops the guidance entirely when it
  // targets a commercial route and mode is garden.
  const adapted = adaptGuidanceForMode(guidance as never, mode);
  if (!adapted) return fallbackForMode(mode);
  return adapted as PrimaryGuidance;
}

export default Object.freeze({ getPrimaryGuidance });
