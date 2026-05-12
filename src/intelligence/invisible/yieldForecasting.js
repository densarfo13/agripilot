/**
 * yieldForecasting.js — cautious yield trend signal
 * (Invisible Intelligence spec §7).
 *
 *   const signal = computeYieldForecasting({
 *     crop, plantingDate, growthStage, weatherRisks,
 *     scanSeverity, completedTaskCount, landHealth,
 *   });
 *
 * "No exact yield promises" guarantee
 * ───────────────────────────────────
 *   The spec is explicit: "No exact yield promises unless data
 *   quality is strong." We extend that to ALL cases. This module
 *   emits ONE of three qualitative trends:
 *     • improving
 *     • stable
 *     • at_risk
 *
 *   Plus a calm farmer-language line + the data drivers that
 *   moved the needle. We NEVER emit a percentage, a yield
 *   number, a tonnage, or a "harvest will be X% lower" claim.
 *
 *   The trend itself is derived from data we ALREADY have:
 *     • Active high-level predictive risks (fungal/drought/heat)
 *     • Recent severe scan severity
 *     • Task completion rate (engagement → better yield correlation)
 *     • Land-health stress level (from satelliteAutomation)
 *
 *   When inputs are sparse, the module returns "stable" with low
 *   confidence — which is the honest default for a farmer who
 *   just opened the app.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Never emits a quantitative yield estimate.
 *   • Cautious language: "Yield outlook looks stable" / "Disease
 *     risk may reduce harvest if not managed."
 */

import { makeQuietFallback, makeActiveSignal } from './moduleShape.js';

const SOURCE = 'yieldForecasting';

function _normSeverity(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('high'))   return 3;
  if (s.includes('medium')) return 2;
  if (s.includes('low'))    return 1;
  return 0;
}

export function computeYieldForecasting(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const crop = (typeof safe.crop === 'string' && safe.crop.trim()) ? safe.crop.trim() : null;
  if (!crop) {
    return makeQuietFallback(SOURCE, 'Yield outlook will improve when a crop is selected.');
  }

  const risks = Array.isArray(safe.weatherRisks) ? safe.weatherRisks : [];
  const hasHighRisk = risks.some((r) => r && r.level === 'high');
  const hasMediumRisk = risks.some((r) => r && r.level === 'medium');
  const scanSeverity = _normSeverity(safe.scanSeverity);
  const completedTasks = Math.max(0, Number(safe.completedTaskCount) || 0);
  const landStress = String(safe.landHealth || '').toLowerCase();

  // ── At-risk signals (any one fires "at_risk") ───────────────
  if (hasHighRisk || scanSeverity === 3 || landStress === 'high') {
    const drivers = [];
    if (hasHighRisk)       drivers.push('weather pressure');
    if (scanSeverity === 3) drivers.push('recent scan severity');
    if (landStress === 'high') drivers.push('land-health stress');
    return makeActiveSignal({
      signal:           'at_risk',
      confidence:       'medium',
      farmerMessage:    `Disease or weather risk may reduce ${crop} harvest if not managed.`,
      recommendedAction: 'Open today’s plan and clear the highest-priority tasks first.',
      urgency:          'high',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  // ── Improving signals (engagement + no risk = improving) ────
  if (completedTasks >= 3 && !hasMediumRisk && scanSeverity <= 1 && landStress !== 'medium') {
    return makeActiveSignal({
      signal:           'improving',
      confidence:       'medium',
      farmerMessage:    `Yield outlook for ${crop} looks like it is improving.`,
      recommendedAction: 'Keep up the routine you’re on.',
      urgency:          'low',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  // ── Stable default ──────────────────────────────────────────
  return makeActiveSignal({
    signal:           'stable',
    confidence:       'low',
    farmerMessage:    `Yield outlook for ${crop} looks stable.`,
    recommendedAction: null,
    urgency:          'low',
    source:           SOURCE,
    visibleToUser:    true,
  });
}

export default { computeYieldForecasting };
