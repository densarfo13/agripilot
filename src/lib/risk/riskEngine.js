/**
 * riskEngine.js — deterministic risk assessment.
 *
 *   getRisk({ crop, regionProfile, recentIssueCount }) → {
 *     level:   'low' | 'medium' | 'high',
 *     type:    'pest' | 'disease' | 'weather',
 *     message: string,        // plain English fallback
 *     messageKey: string,     // stable i18n key
 *     reasons: Array<{ rule, detail }>,
 *   }
 *
 * Rules (spec §4):
 *   • tropical + wet + cassava → pest risk high
 *   • temperate + winter       → low risk (dormant season)
 *   • repeated issues on same farm → bump level by one band
 *   • sensible defaults for everything else
 *
 * Pure. Frozen output.
 */

const LEVEL_ORDER = Object.freeze(['low', 'medium', 'high']);

function bumpLevel(level, steps = 1) {
  const idx = LEVEL_ORDER.indexOf(level);
  const next = Math.min(LEVEL_ORDER.length - 1, Math.max(0, idx + steps));
  return LEVEL_ORDER[next];
}

export function getRisk({ crop = null, regionProfile = null, recentIssueCount = 0 } = {}) {
  const reasons = [];
  let level = 'low';
  let type = 'weather';
  let messageKey = 'risk.default.low';
  let message = 'Conditions look stable.';

  if (!regionProfile) {
    reasons.push({ rule: 'no_region_profile', detail: 'Using conservative default' });
    return Object.freeze({
      level: 'low', type, message, messageKey,
      reasons: Object.freeze(reasons.map(Object.freeze)),
    });
  }

  const { climate, season } = regionProfile;
  const cropKey = crop ? String(crop).toLowerCase() : '';

  // ─── Specific callouts ───────────────────────────────────────
  // Cassava in tropical wet season — cassava mosaic and whitefly
  // pressure are well-documented. Flag as high pest risk.
  if (climate === 'tropical' && season === 'wet' && cropKey === 'cassava') {
    level = 'high';
    type = 'pest';
    messageKey = 'risk.cassava.tropical_wet';
    message = 'Tropical wet season — watch for whitefly and mosaic virus on cassava.';
    reasons.push({ rule: 'cassava_tropical_wet', detail: 'High pest pressure in wet season' });
  }
  // Temperate winter — most crops are dormant or protected.
  else if (climate === 'temperate' && season === 'winter') {
    level = 'low';
    type = 'weather';
    messageKey = 'risk.temperate.winter';
    message = 'Temperate winter — most crops are dormant. Low risk.';
    reasons.push({ rule: 'temperate_winter_low', detail: 'Dormant season' });
  }
  // Arid + dry → water/drought risk is the dominant concern.
  else if (climate === 'arid' && season === 'dry') {
    level = 'medium';
    type = 'weather';
    messageKey = 'risk.arid.dry';
    message = 'Arid dry season — water stress is the main risk.';
    reasons.push({ rule: 'arid_dry', detail: 'Low rainfall and heat' });
  }
  // Tropical wet — general pest/disease pressure bumps when staple
  // crops are in the ground.
  else if (climate === 'tropical' && season === 'wet') {
    level = 'medium';
    type = 'pest';
    messageKey = 'risk.tropical.wet';
    message = 'Tropical wet season — pests and leaf disease more active.';
    reasons.push({ rule: 'tropical_wet_baseline', detail: 'Pest + disease season' });
  }
  // Tropical dry — heat stress risk.
  else if (climate === 'tropical' && season === 'dry') {
    level = 'medium';
    type = 'weather';
    messageKey = 'risk.tropical.dry';
    message = 'Tropical dry season — water stress is the main risk.';
    reasons.push({ rule: 'tropical_dry', detail: 'Heat stress season' });
  }
  // Temperate growing seasons — baseline low-medium.
  else if (climate === 'temperate' && (season === 'spring' || season === 'fall')) {
    level = 'low';
    type = 'weather';
    messageKey = 'risk.temperate.shoulder';
    message = 'Temperate shoulder season — conditions usually stable.';
    reasons.push({ rule: 'temperate_shoulder', detail: 'Stable weather window' });
  }
  else if (climate === 'temperate' && season === 'summer') {
    level = 'medium';
    type = 'pest';
    messageKey = 'risk.temperate.summer';
    message = 'Temperate summer — peak growing + pest pressure.';
    reasons.push({ rule: 'temperate_summer', detail: 'Peak growing season' });
  }

  // ─── Repeat-issue escalation ─────────────────────────────────
  if (Number(recentIssueCount) >= 3) {
    const before = level;
    level = bumpLevel(level, 1);
    if (level !== before) {
      reasons.push({
        rule: 'repeated_farm_issues',
        detail: `${recentIssueCount} recent issues on this farm`,
      });
    }
  }

  return Object.freeze({
    level, type, message, messageKey,
    reasons: Object.freeze(reasons.map(Object.freeze)),
  });
}

export const _internal = Object.freeze({ LEVEL_ORDER, bumpLevel });
