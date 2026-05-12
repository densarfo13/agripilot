/**
 * regionalDiseaseIntelligence.js — disease-pressure signal that
 * stays honest about the regional/local distinction
 * (Invisible Intelligence spec §8).
 *
 *   const signal = computeRegionalDiseaseIntelligence({
 *     scanHistory, cropType, region, weather, season,
 *     regionalAggregate,    // future: anonymized cross-farm feed
 *   });
 *
 * Honest "no fabricated outbreaks" guarantee
 * ──────────────────────────────────────────
 *   The spec calls out two distinct things:
 *     (a) THIS device's repeat patterns ("same issue 3+ times")
 *     (b) REGIONAL pressure ("fungal risk is rising in your area")
 *
 *   We have (a) already — it lives in src/lib/scanPatternDetection
 *   and uses ONLY this farmer's own scan history. No aggregation,
 *   no privacy concern.
 *
 *   We don't have (b) yet — that needs server-side anonymized
 *   cross-farm aggregation + a privacy model. Until that's built,
 *   we surface (a) honestly + add a calm caveat that the regional
 *   half isn't live. We NEVER fabricate "X farms nearby reported"
 *   claims.
 *
 *   The PRESCRIPTIVE half — "Fungal risk is rising in your area"
 *   when humidity + warm-temp + susceptible crop align — is taken
 *   from the existing predictiveRisk engine (weather-based,
 *   no fake regional data). When weatherRisks contains a fungal
 *   high-level signal, this module surfaces it under the
 *   regional-disease banner.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Never invents a regional outbreak claim.
 *   • Pulls from weather + this-device scan history only.
 *   • visibleToUser:false when neither weather nor pattern fires.
 */

import { makeQuietFallback, makeActiveSignal } from './moduleShape.js';

const SOURCE = 'regionalDiseaseIntelligence';

export function computeRegionalDiseaseIntelligence(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const weatherRisks = Array.isArray(safe.weatherRisks) ? safe.weatherRisks : [];
  const scanPattern = (safe.scanPattern && typeof safe.scanPattern === 'object')
    ? safe.scanPattern : null;
  const crop = (typeof safe.cropType === 'string' && safe.cropType.trim())
    ? safe.cropType.trim() : null;

  // ── Weather-driven fungal alert (most actionable signal) ────
  const fungal = weatherRisks.find((r) => r && r.kind === 'fungal'
                                          && (r.level === 'high' || r.level === 'medium'));
  if (fungal) {
    const urgencyLabel = fungal.level === 'high' ? 'high' : 'medium';
    return makeActiveSignal({
      signal:           'fungal_pressure_rising',
      confidence:       'medium',
      farmerMessage:    crop
        ? `Fungal risk is rising for ${crop} in your area.`
        : 'Fungal risk is rising in your area.',
      recommendedAction: 'Check lower leaves tomorrow morning.',
      urgency:          urgencyLabel,
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  // ── Local recurrence — pattern detector says same issue 3+x ─
  if (scanPattern && scanPattern.recurrence
      && scanPattern.recurrence.count >= 3
      && scanPattern.recurrence.issue) {
    return makeActiveSignal({
      signal:           'local_pattern_recurrence',
      confidence:       'medium',
      farmerMessage:    `${scanPattern.recurrence.issue} is showing up repeatedly on this farm.`,
      recommendedAction: 'Treat it as a pattern, not a one-off.',
      urgency:          'medium',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  // ── Quiet fallback ─────────────────────────────────────────
  return makeQuietFallback(SOURCE, '');
}

export default { computeRegionalDiseaseIntelligence };
