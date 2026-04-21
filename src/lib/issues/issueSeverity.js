/**
 * issueSeverity.js — deterministic severity assignment for a
 * farmer-reported issue.
 *
 *   scoreSeverity({
 *     description,
 *     classification,          // output of classifyIssue
 *     crop,                    // lower-cased canonical code
 *     recentFarmIssueCount,    // # of issues from this farm in last 7 days
 *     now                      // epoch ms (for reason timestamps)
 *   }) → {
 *     severity: 'low' | 'medium' | 'high' | 'critical',
 *     reasons:  Array<{ rule, weight }>,
 *   }
 *
 * The caller's explicit severity (if any) is NOT consumed here —
 * this module computes a from-scratch view. The orchestrator in
 * automationRules.js reconciles: an explicit caller severity always
 * wins the final plan, but the scored value is kept in the audit
 * trail so admin can see why automation disagreed.
 *
 * Pure. No side effects.
 */

const SEVERITY_ORDER = Object.freeze(['low', 'medium', 'high', 'critical']);

/**
 * Staple-crop disease deserves a severity bump — these crops drive
 * food security programs and a missed disease is a bigger deal.
 */
const STAPLE_CROPS = new Set(['maize', 'rice', 'wheat', 'cassava', 'sorghum', 'yam', 'millet']);

function includes(desc, needle) {
  return String(desc || '').toLowerCase().includes(needle);
}

function bumpSeverity(level, steps = 1) {
  const idx = SEVERITY_ORDER.indexOf(level);
  const next = Math.min(SEVERITY_ORDER.length - 1, idx + steps);
  return SEVERITY_ORDER[next];
}

export function scoreSeverity({
  description  = '',
  classification = null,
  crop          = null,
  recentFarmIssueCount = 0,
} = {}) {
  const reasons = [];
  let severity = 'low';

  const cat = classification && classification.issueType;
  const conf = classification && classification.confidence;

  // ─── Start from category baseline ────────────────────────────
  if (cat === 'water') {
    // Flood / waterlogging words are explicitly HIGH; drought wording
    // is MEDIUM by default (farmer can still water) and only becomes
    // HIGH when "no rain for days" / "drought" appears.
    if (includes(description, 'flood') || includes(description, 'standing water')
        || includes(description, 'waterlogged') || includes(description, 'waterlogging')) {
      severity = 'high';
      reasons.push({ rule: 'flood_or_waterlogging', weight: 3 });
    } else if (includes(description, 'drought') || includes(description, 'no rain')) {
      severity = 'high';
      reasons.push({ rule: 'drought_or_no_rain', weight: 3 });
    } else {
      severity = 'medium';
      reasons.push({ rule: 'water_issue_baseline', weight: 2 });
    }
  } else if (cat === 'weather_damage') {
    severity = 'high';
    reasons.push({ rule: 'weather_damage_baseline', weight: 3 });
  } else if (cat === 'disease') {
    severity = 'medium';
    reasons.push({ rule: 'disease_baseline', weight: 2 });
    if (STAPLE_CROPS.has(String(crop || '').toLowerCase())) {
      severity = 'high';
      reasons.push({ rule: 'staple_crop_disease', weight: 2 });
    }
  } else if (cat === 'pest') {
    severity = 'medium';
    reasons.push({ rule: 'pest_baseline', weight: 2 });
  } else if (cat === 'nutrient') {
    severity = 'low';
    reasons.push({ rule: 'nutrient_baseline', weight: 1 });
  } else {
    severity = 'medium';
    reasons.push({ rule: 'default_baseline', weight: 1 });
  }

  // ─── Scale-of-damage heuristics in the description ───────────
  if (includes(description, 'whole farm') || includes(description, 'entire farm')
      || includes(description, 'everywhere') || includes(description, 'all my')
      || includes(description, 'all of the')) {
    severity = bumpSeverity(severity, 2); // jump two tiers
    reasons.push({ rule: 'widespread_damage', weight: 3 });
  } else if (includes(description, 'many plants') || includes(description, 'most of')
             || includes(description, 'half the')) {
    severity = bumpSeverity(severity, 1);
    reasons.push({ rule: 'multiple_plants', weight: 2 });
  } else if (includes(description, 'one plant') || includes(description, 'a few plants')
             || includes(description, 'small area')) {
    // No bump — already-low issues stay low.
    reasons.push({ rule: 'localized_damage', weight: 1 });
  }

  // Explicit panic words → critical.
  if (includes(description, 'emergency') || includes(description, 'dying')
      || includes(description, 'destroyed') || includes(description, 'killed')) {
    severity = 'critical';
    reasons.push({ rule: 'emergency_language', weight: 4 });
  }

  // ─── Repeat-reports bump ─────────────────────────────────────
  // Spec §5: "repeated reports from same farm in short period →
  // increase severity by one band". Applied after scale heuristics
  // so we never bump past critical.
  if (Number(recentFarmIssueCount) >= 3) {
    const before = severity;
    severity = bumpSeverity(severity, 1);
    if (severity !== before) {
      reasons.push({
        rule: 'repeated_farm_reports',
        weight: 2,
        detail: `${recentFarmIssueCount} reports in 7 days`,
      });
    }
  }

  // ─── Low-confidence pullback ─────────────────────────────────
  // Don't escalate aggressively when we're not sure. If category
  // was inferred at `low` confidence AND we don't have any
  // emergency language, cap at 'medium'.
  if (conf === 'low' && !reasons.some((r) => r.rule === 'emergency_language')) {
    const idx = SEVERITY_ORDER.indexOf(severity);
    if (idx > 1) {
      severity = 'medium';
      reasons.push({ rule: 'low_confidence_capped_to_medium', weight: 1 });
    }
  }

  return Object.freeze({
    severity,
    reasons: Object.freeze(reasons.map(Object.freeze)),
  });
}

export const _internal = Object.freeze({
  SEVERITY_ORDER, STAPLE_CROPS, bumpSeverity,
});
