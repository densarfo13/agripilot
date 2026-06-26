/**
 * V15CapabilityRegistry.ts — Farroway v15 honest capability map.
 *
 * v15 asks FarmBrain to become an "autonomous reasoning engine" with profit/yield/
 * carbon optimization, ROI planning, disease surveillance, a digital soil lab
 * (NPK/CEC/microbial), and a financial engine. Most would require fabricating the
 * numbers v15's own AI-SAFETY section forbids. This registry tells the truth.
 *
 * Pure, total, browser-safe.
 */
export type V15Status =
  | 'live' | 'advisory' | 'planned' | 'no_live_feed' | 'requires_model' | 'requires_validation';

export interface V15Capability { id: string; area: string; status: V15Status; basis: string; }
const C = (id: string, area: string, status: V15Status, basis: string): V15Capability =>
  Object.freeze({ id, area, status, basis });

export const V15_CAPABILITIES: ReadonlyArray<V15Capability> = Object.freeze([
  // Built real this sprint
  C('farmer_copilot', 'Farmer Copilot (natural language)', 'live', 'Deterministic intent router → existing engines (farm agent / crop calendar / weather risk); declines profit honestly.'),

  // FarmBrain 3.0 — composed where real, declared where not
  C('farmbrain_daily_plan', 'FarmBrain daily plan', 'live', 'Composes the farm agent morning plan from real signals (existing).'),
  C('farmbrain_risk', 'FarmBrain risk prediction', 'advisory', 'Weather risk is live; agronomic risk is heuristic from real signals — not a fabricated probability.'),
  C('farmbrain_optimization', 'FarmBrain profit/yield/carbon optimization', 'requires_model', 'Optimization needs measured costs/prices/yields + a model. No fabricated optimum.'),
  C('autonomous_roi_plan', 'Autonomous plan with cost/ROI/expected-benefit', 'no_live_feed', 'ROI/cost/benefit need price + cost data not wired. Plans are produced WITHOUT fabricated economics.'),

  // Specialist + surveillance
  C('digital_agronomist', 'Digital Agronomist (why/evidence/confidence/impact)', 'live', 'Agronomist agent + scan recommendation carry why+evidence+confidence; economic/environmental impact stays honest-null until measured.'),
  C('digital_entomologist', 'Digital Entomologist (lifecycle/IPM)', 'requires_model', 'Population tracking + lifecycle forecast need a trained model + monitoring data. IPM guidance is advisory on a CONFIRMED pest only.'),
  C('disease_surveillance', 'Global Disease Surveillance', 'planned', 'Regional outbreak intelligence needs a privacy-reviewed anonymous aggregation pipeline. No personal farmer data leaves the farm.'),

  // Soil + calendar
  C('digital_soil_lab', 'Digital Soil Lab (NPK/CEC/microbial/salinity)', 'requires_model', 'These need a real soil test. moisture/pH/organic come from SoilGrids/Ambee; N/P/K/CEC/microbial/salinity are unknown, never estimated.'),
  C('global_crop_calendar', 'Global Crop Calendar (every country)', 'advisory', 'Real calendars for supported crops; unsupported crops return unknown, never a fabricated date. NOT "every country" yet.'),
  C('photo_timeline', 'Photo Timeline + progression', 'planned', 'An ordered scan history is real, non-predictive data; growth/health "animation" is a UI build over it — scoped, not faked.'),

  // Copilot-adjacent declines
  C('financial_engine', 'Financial Engine (revenue/profit/cash-flow/loan)', 'no_live_feed', 'No price/cost feed. Revenue/profit/break-even/loan-readiness are never fabricated.'),
  C('export_engine', 'Export Engine (readiness/compliance/cold-chain)', 'advisory', 'Honest readiness CHECKLISTS against documented criteria; not a fabricated certificate or score.'),

  // Platform doctrine
  C('self_improving_knowledge', 'Self-Improving Knowledge', 'requires_validation', 'Captures feedback/outcomes; improves ONLY through a validation pipeline. Never auto-retrains (existing doctrine).'),
  C('multimodal_ai', 'Multimodal (image/video/drone/satellite/audio/sensor/PDF)', 'no_live_feed', 'Image + multi-image are live; video/drone/satellite/audio/sensor/PDF ingestion are not wired — declared, not stubbed.'),
]);

export function v15CapabilityHealth() {
  const byStatus: Record<string, number> = {};
  for (const c of V15_CAPABILITIES) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  const live = new Set(V15_CAPABILITIES.filter(c => c.status === 'live').map(c => c.id));
  const mustNotBeLive = ['farmbrain_optimization', 'autonomous_roi_plan', 'digital_soil_lab', 'financial_engine', 'disease_surveillance'];
  return Object.freeze({
    ok: true,
    total: V15_CAPABILITIES.length,
    live: live.size,
    byStatus: Object.freeze(byStatus),
    nothingFabricatedAsLive: mustNotBeLive.every(id => !live.has(id)),
    everyCapHasBasis: V15_CAPABILITIES.every(c => c.basis && c.basis.length > 10),
  });
}

export function installV15CapabilityHealth(): void {
  try {
    if (typeof window === 'undefined' || (window as any).__v15CapabilityHealth) return;
    Object.defineProperty(window, '__v15CapabilityHealth', {
      configurable: true, enumerable: false, writable: false, value: () => v15CapabilityHealth(),
    });
  } catch { /* swallow */ }
}
