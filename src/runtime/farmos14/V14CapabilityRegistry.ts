/**
 * V14CapabilityRegistry.ts — Farroway v14 honest capability map.
 *
 * v14 asks for ~16 domain/infra engines. Most would require fabricating the
 * numbers its own AI-SAFETY section forbids (yield/revenue/profit, market prices,
 * credit + insurance scores, outbreak prediction, carbon savings) or are pure ops
 * (Kafka, Redis Cluster, multi-region, OpenTelemetry, SOC2). This registry tells
 * the truth about each so nothing is shipped as working that isn't.
 *
 * Status: live | advisory | planned | no_live_feed | requires_model |
 *         requires_validation | requires_infra. Pure, total, browser-safe.
 */
export type V14Status =
  | 'live' | 'advisory' | 'planned' | 'no_live_feed' | 'requires_model' | 'requires_validation' | 'requires_infra';

export interface V14Capability {
  id: string; area: string; status: V14Status; basis: string; noFabrication: boolean;
}
const C = (id: string, area: string, status: V14Status, basis: string): V14Capability =>
  Object.freeze({ id, area, status, basis, noFabrication: true });

export const V14_CAPABILITIES: ReadonlyArray<V14Capability> = Object.freeze([
  // Built real this sprint
  C('multi_agent_ai', 'Multi-Agent AI (12 specialists)', 'live', 'AgentRegistry — agronomist/weather/soil advise from real engines; the other 9 honestly decline (confidence 0) instead of fabricating expertise.'),

  // Twin + prediction
  C('global_digital_twin', 'Global Farm Digital Twin', 'live', 'farmos13 twin tracks the farm hierarchy + last-known state. Equipment/livestock/buildings can be added as node types.'),
  C('twin_multi_horizon', 'Twin 7/30/90/180/365-day prediction', 'requires_validation', 'Multi-horizon future state needs a trained model. Only calendar-based estimates (with a basis) are honest today — no fabricated 365-day forecast.'),

  // Precision agriculture (external hardware/feeds)
  C('precision_agriculture', 'Precision Ag (satellite/drone/IoT/probes/machinery)', 'no_live_feed', 'No satellite/drone/IoT/GPS-machinery integrations wired. Each needs a real device feed; not stubbed with fake telemetry.'),

  // Fabrication-bait predictive engines — declared, not faked
  C('ai_yield_engine', 'AI Yield Engine (yield/revenue/profit/losses + CI)', 'requires_model', 'Yield/revenue/profit/loss prediction needs measured counts + harvest history + a model. No fabricated figure or confidence interval.'),
  C('global_market_engine', 'Global Market Engine (prices/demand/buyers/contracts)', 'no_live_feed', 'No market data feed. Price/demand/buyer-matching are never fabricated (hard rule).'),
  C('climate_engine', 'Climate Engine (heat/flood/drought/outbreaks)', 'requires_validation', 'Near-term weather risk is live (WeatherRiskRuntime); disease/pest OUTBREAK prediction needs a trained model + regional feeds — not fabricated.'),
  C('banking_engine', 'Banking Engine (credit/risk/insurance/loan scores)', 'planned', 'Credit/insurance scoring needs audited financial data + a regulated model. A fabricated score could harm a farmer — declared, never invented.'),

  // Institutional surfaces (some real today)
  C('research_engine', 'Research / Anonymous Benchmarking', 'planned', 'Cross-farm benchmarking needs a privacy-reviewed anonymous aggregation pipeline. Farmer data never leaves the farm.'),
  C('ngo_engine', 'NGO Engine (adoption/yield/impact/resilience)', 'advisory', 'NGO analytics surfaces exist over REAL recorded outcomes; impact/carbon-savings figures stay honest-null until measured (existing doctrine).'),
  C('government_engine', 'Government Engine (food-security/surveillance/forecasts)', 'planned', 'Regional dashboards need aggregated, consented data + a forecast model. Surveillance/forecast numbers are not fabricated.'),

  // Supply chain + traceability (data plumbing, not AI)
  C('supply_chain', 'Supply Chain (harvest→packing→storage→export→retail)', 'planned', 'A chain-of-custody record is buildable real (no AI); not yet implemented — declared, not faked.'),
  C('food_traceability', 'Food Traceability (farm→consumer + QR)', 'planned', 'Verifiable chain-of-custody + QR is real, non-predictive data plumbing; scoped as the most honest next real feature.'),

  // Platform-wide ops/infra
  C('observability', 'Observability (OTel/Prometheus/Grafana/Sentry/SLA)', 'requires_infra', 'In-app health globals + provider SLA exist; distributed tracing / metrics stacks are infra wiring, not app code authored here.'),
  C('enterprise_security', 'Enterprise Security (ZeroTrust/MFA/SSO/RBAC/SOC2)', 'requires_infra', 'RBAC + auth + audit logging exist in-app; ZeroTrust/SSO/SOC2/ISO are an ops + certification program, not a code change.'),
  C('scalability', 'Scalability (100M farms / Kafka / Redis Cluster / HA)', 'requires_infra', 'Postgres + Railway today; Kafka/Redis-Cluster/multi-region/event-sourcing are an infra program. "100M farms" is not asserted from a sprint.'),
]);

export function v14CapabilityHealth() {
  const byStatus: Record<string, number> = {};
  for (const c of V14_CAPABILITIES) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  const live = new Set(V14_CAPABILITIES.filter(c => c.status === 'live').map(c => c.id));
  const mustNotBeLive = ['ai_yield_engine', 'global_market_engine', 'banking_engine', 'climate_engine', 'precision_agriculture', 'twin_multi_horizon'];
  return Object.freeze({
    ok: true,
    total: V14_CAPABILITIES.length,
    live: live.size,
    byStatus: Object.freeze(byStatus),
    nothingFabricatedAsLive: mustNotBeLive.every(id => !live.has(id)),
    everyCapHasBasis: V14_CAPABILITIES.every(c => c.basis && c.basis.length > 10),
  });
}

export function installV14CapabilityHealth(): void {
  try {
    if (typeof window === 'undefined' || (window as any).__v14CapabilityHealth) return;
    Object.defineProperty(window, '__v14CapabilityHealth', {
      configurable: true, enumerable: false, writable: false, value: () => v14CapabilityHealth(),
    });
  } catch { /* swallow */ }
}
