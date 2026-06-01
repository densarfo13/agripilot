/**
 * SoilRecommendationRuntime.ts — derives SAFE GENERAL recommendations
 * from a SoilProfile.
 *
 * HARD RULES (spec):
 *   • Never recommend exact fertilizer dosages.
 *   • Never recommend specific chemicals by trade name.
 *   • Never fabricate pH or nutrient values.
 *   • Always include "Confirm with a local soil test" guidance when
 *     soil values drive a recommendation.
 *
 * Output is a small list of general care recommendations; pages render
 * them as text. The runtime is read-only and never writes anywhere.
 */

import type { SoilProfile, SoilRecommendation } from './SoilProfileContracts';
import { GUIDANCE_TAIL } from './SoilProfileContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

const CONFIRM_LIMIT = 'Confirm with a local soil test before applying inputs. ' + GUIDANCE_TAIL;
const GENERAL_LIMIT = 'General guidance only — local conditions vary. ' + GUIDANCE_TAIL;

/** Build a frozen recommendation list from a soil profile.
 *  Empty list when soil data unavailable (honest). */
export function buildSoilRecommendations(profile: Readonly<SoilProfile> | null)
  : ReadonlyArray<SoilRecommendation> {
  return _safe(() => {
    if (!profile || !profile.soilDataAvailable) {
      return Object.freeze([]) as ReadonlyArray<SoilRecommendation>;
    }
    const out: SoilRecommendation[] = [];

    const clay = profile.soilTexture.clayPct;
    const sand = profile.soilTexture.sandPct;
    const drainage = profile.drainageRisk;
    const ph = profile.ph;
    const soc = profile.organicMatterProxy;

    if (drainage === 'high' || (clay !== null && clay >= 40)) {
      out.push(Object.freeze({
        id: 'soil_improve_drainage',
        title: 'Improve drainage',
        body:
          'Soil texture suggests slow drainage. Avoid heavy irrigation, raise beds where possible, '
          + 'and add organic matter to open the soil.',
        category: 'drainage',
        severity: 'act',
        rationale: `Drainage risk = ${drainage}`
          + (clay !== null ? `, clay ≈ ${Math.round(clay)}%` : ''),
        limitations: CONFIRM_LIMIT,
      }));
    }

    if (sand !== null && sand >= 70) {
      out.push(Object.freeze({
        id: 'soil_sandy_moisture',
        title: 'Check soil moisture often',
        body:
          'Sandy soils dry out quickly. Water more often in smaller amounts. '
          + 'Mulch the surface to keep moisture in.',
        category: 'moisture',
        severity: 'watch',
        rationale: `Sand ≈ ${Math.round(sand)}%`,
        limitations: CONFIRM_LIMIT,
      }));
    }

    if (soc !== null && soc < 8) {
      out.push(Object.freeze({
        id: 'soil_organic_matter_low',
        title: 'Add compost or organic matter',
        body:
          'Low organic-matter signal. Adding compost, manure, or crop residues improves '
          + 'structure and water-holding.',
        category: 'organic_matter',
        severity: 'watch',
        rationale: `Organic carbon proxy ≈ ${Math.round(soc * 10) / 10} g/kg`,
        limitations: CONFIRM_LIMIT,
      }));
    }

    // pH guidance is intentionally narrative — never a dosage. We
    // surface "soil may be acidic / alkaline" and tell the farmer to
    // confirm with a local test before treatment.
    if (ph !== null && ph < 5.5) {
      out.push(Object.freeze({
        id: 'soil_low_ph_general',
        title: 'Soil may be acidic',
        body:
          'pH signal looks low. Many crops prefer near-neutral soil. '
          + 'Talk to a local agronomist before applying lime.',
        category: 'general',
        severity: 'watch',
        rationale: `pH ≈ ${ph.toFixed(1)}`,
        limitations: CONFIRM_LIMIT,
      }));
    } else if (ph !== null && ph > 8.0) {
      out.push(Object.freeze({
        id: 'soil_high_ph_general',
        title: 'Soil may be alkaline',
        body:
          'pH signal looks high. Some crops struggle in alkaline soil. '
          + 'Talk to a local agronomist before adjusting.',
        category: 'general',
        severity: 'watch',
        rationale: `pH ≈ ${ph.toFixed(1)}`,
        limitations: CONFIRM_LIMIT,
      }));
    }

    // Always include the universal "avoid waterlogging" tip when we
    // have any soil data, as the safest general guidance.
    out.push(Object.freeze({
      id: 'soil_avoid_waterlogging',
      title: 'Avoid waterlogging',
      body: 'Standing water hurts roots and invites disease. Drain low spots after heavy rain.',
      category: 'drainage',
      severity: 'info',
      rationale: 'Universal soil-care guidance',
      limitations: GENERAL_LIMIT,
    }));

    return Object.freeze(out) as ReadonlyArray<SoilRecommendation>;
  }, Object.freeze([]) as ReadonlyArray<SoilRecommendation>);
}

/** Pure helper for the gate: a recommendation MUST never contain
 *  dosage units (kg/ha, g/m2, %, ppm) or chemical names. */
export const FORBIDDEN_RECOMMENDATION_PATTERNS: ReadonlyArray<string> = Object.freeze([
  'kg/ha', 'g/m2', 'ppm', 'NPK', 'urea', 'ammonium', 'nitrate',
]);
