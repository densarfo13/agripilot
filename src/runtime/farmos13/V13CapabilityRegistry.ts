/**
 * V13CapabilityRegistry.ts — Farroway v13 honest capability map.
 *
 * The v13 spec asks for ~20 capability areas. Most cannot be built as real
 * capability right now without fabricating the very numbers the spec's AI-SAFETY
 * section forbids (future prices, time-until-outbreak, carbon credits, 250k
 * species, satellite NDVI). This registry tells the TRUTH about each one, so the
 * platform can declare a capability's real state instead of faking it.
 *
 * Status meaning:
 *   live                 — composed from a real source, working today
 *   advisory             — reference/heuristic guidance, not measured
 *   planned              — architecture documented; not active (no fabricated output)
 *   no_live_feed         — needs an external data feed not wired (e.g. market, satellite)
 *   requires_cv          — needs a vision/ML model we do not run
 *   requires_validation  — self-learning gated until validated (never auto-retrain)
 *   requires_infra       — enterprise infra (Redis/workers/scale) — ops, not app code
 *
 * Pure, total, browser-safe.
 */
export type CapabilityStatus =
  | 'live' | 'advisory' | 'planned' | 'no_live_feed' | 'requires_cv' | 'requires_validation' | 'requires_infra';

export interface Capability {
  id: string;
  area: string;
  status: CapabilityStatus;
  /** What it's composed from (live/advisory) OR what it would require (everything else). */
  basis: string;
  /** True when this capability must NEVER emit a fabricated value in its current state. */
  noFabrication: boolean;
}

const C = (id: string, area: string, status: CapabilityStatus, basis: string, noFabrication = true): Capability =>
  Object.freeze({ id, area, status, basis, noFabrication });

export const V13_CAPABILITIES: ReadonlyArray<Capability> = Object.freeze([
  // ── Built real this sprint ──
  C('digital_twin', 'Agricultural Digital Twin', 'live', 'Farm›Field›…›Plant node model; scans update last-known state + honest staleness (no fabricated future state).'),
  C('farm_agent', 'Autonomous Farm Agent', 'live', 'Morning planner composing crop calendar + live-weather risk + scan staleness + last-action into a prioritized, evidence-cited list.'),
  C('scan_v12', 'Unified Scan Intelligence', 'live', 'analyzeScanV12 — 98-field taxonomy with honest status per field (sprint v12).'),

  // ── Real where a source exists; honest gap otherwise ──
  C('knowledge_engine', 'Universal Knowledge Engine', 'advisory', 'Curated botanical reference (~12 crops) + plant JSON datasets. NOT 250,000 species — unlisted plants return unknown, never fabricated taxonomy.'),
  C('field_intelligence', 'Field Intelligence (counts/canopy/NDVI)', 'requires_cv', 'Stand count, density, gaps, canopy %, vegetation index, ripeness — all need a vision model we do not run.'),
  C('soil_ai', 'Soil AI (living soil model)', 'advisory', 'Moisture/pH/organic from SoilGrids/Ambee when present; N/P/K/CEC need a lab test — returned unknown, never invented.'),
  C('weather_intelligence', 'Weather Intelligence', 'live', 'WeatherRiskRuntime derives rain/frost/heat/wind risk from the live forecast; stress mapping is honest estimate.'),

  // ── Predictive asks that would require fabrication — declared, not faked ──
  C('disease_prediction', 'Pre-symptom Disease Prediction', 'requires_validation', 'Predicting an outbreak time/probability needs a trained model + outcome data. No model → no fabricated "time until outbreak".'),
  C('pest_forecasting', 'Pest Forecasting (migration/breeding)', 'requires_validation', 'Needs regional outbreak feeds + a trained model. Not fabricated.'),
  C('yield_twin', 'Yield Digital Twin', 'requires_cv', 'Yield/grade/loss prediction needs measured counts (CV) + harvest history. Calendar harvest-date is the only honest part today.'),
  C('market_ai', 'Market AI (future prices)', 'no_live_feed', 'Price/demand/buyer prediction has NO live feed wired. Market is never fabricated (hard rule).'),

  // ── External sensing layers — not wired ──
  C('satellite_layer', 'Satellite (Sentinel/Landsat/Planet/NDVI)', 'no_live_feed', 'No satellite provider integrated. NDVI/NDRE/moisture from space are not available — declared, not stubbed with fake values.'),
  C('drone_layer', 'Drone Missions', 'no_live_feed', 'No drone ingestion pipeline. Disease/weed/stress from drone imagery needs CV + upload infra.'),
  C('vision_ai_advanced', 'Advanced Vision (thermal/multispectral/microscope/360°)', 'requires_cv', 'No thermal/multispectral hardware or models. Photo + burst + multi-photo are the real inputs.'),

  // ── Sustainability asks that would be fabrication ──
  C('carbon_engine', 'Carbon Engine (stored/emitted/credits)', 'planned', 'Carbon accounting needs audited activity data + a certified methodology. A carbon-credit number would be fabricated.'),
  C('biodiversity_engine', 'Biodiversity Engine', 'planned', 'Pollinator/habitat/species-diversity scoring needs field survey data. Not fabricated.'),
  C('certification_engine', 'Certification Readiness (Organic/GAP/Export/Food-safety)', 'advisory', 'Honest readiness CHECKLISTS against documented criteria — not a fabricated certificate or score.'),

  // ── Platform-wide ──
  C('self_learning', 'Self-Learning', 'requires_validation', 'Captures corrections/outcomes; improves ONLY after validation. Never auto-retrains (existing doctrine).'),
  C('voice_copilot', 'Voice Copilot (multi-language)', 'live', 'i18n layer + Listen/TTS. Hindi remains hidden until translated; offline voice depends on device TTS.'),
  C('offline_mode', 'Offline Mode + Sync', 'live', 'Offline scan queue + auto-sync exist (existing offline runtime); declared at its real coverage.'),
  C('knowledge_graph', 'Global Anonymous Knowledge Graph', 'planned', 'Anonymous aggregation needs a privacy-reviewed pipeline. Never expose farmer data — so declared planned, not silently shipped.'),
  C('enterprise_scale', 'Enterprise Scale (millions of farms, Redis, workers, zero-downtime)', 'requires_infra', 'Horizontal scaling / event-driven workers / CDN are ops & infra, not app code authored here.'),
]);

export type V13Status = 'live' | 'partial' | 'declared';

export function v13CapabilityHealth() {
  const byStatus: Record<string, number> = {};
  for (const c of V13_CAPABILITIES) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  const live = V13_CAPABILITIES.filter(c => c.status === 'live').length;
  // Honesty invariants the gate also checks.
  const marketNotLive = !V13_CAPABILITIES.some(c => c.id === 'market_ai' && c.status === 'live');
  const satelliteNotLive = !V13_CAPABILITIES.some(c => c.id === 'satellite_layer' && c.status === 'live');
  const predictionNotLive = !V13_CAPABILITIES.some(c => (c.id === 'disease_prediction' || c.id === 'pest_forecasting') && c.status === 'live');
  const everyCapHasBasis = V13_CAPABILITIES.every(c => c.basis && c.basis.length > 10);
  return Object.freeze({
    ok: true,
    total: V13_CAPABILITIES.length,
    live,
    byStatus: Object.freeze(byStatus),
    // The whole point: nothing predictive/market/satellite is dressed up as "live".
    nothingFabricatedAsLive: marketNotLive && satelliteNotLive && predictionNotLive,
    everyCapHasBasis,
  });
}

export function installV13CapabilityHealth(): void {
  try {
    if (typeof window === 'undefined' || (window as any).__v13CapabilityHealth) return;
    Object.defineProperty(window, '__v13CapabilityHealth', {
      configurable: true, enumerable: false, writable: false, value: () => v13CapabilityHealth(),
    });
  } catch { /* swallow */ }
}
