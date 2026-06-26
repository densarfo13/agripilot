# GLOBAL_ARCHITECTURE — Farroway v14

v14 extends the platform (scan untouched, backward compatible). The spec asks for
~16 domain engines + a 12-agent AI + planet-scale infra. Most of it can only be
honest as a DECLARATION, not a fabrication — so v14 ships the one genuinely new
real capability and tells the truth about the rest.

## Built real (live)
- **Multi-Agent Advisor** (`src/runtime/farmos14/AgentRegistry.ts`): 12 named
  specialists. Agronomist / Weather Scientist / Soil Scientist **advise from real
  engines** (crop calendar, WeatherRiskRuntime, server-side soil), each returning
  reason + evidence + confidence + alternative. The other 9 (Pathologist,
  Entomologist, Market/Supply-Chain/Export/Financial/Carbon/Biodiversity/Food-
  Safety) **honestly decline** at confidence 0 and point to a human expert — never
  fabricated expertise.
- **Capability Registry** (`V14CapabilityRegistry.ts`): every domain/infra ask
  mapped to a true status with a basis or a named requirement.

## Composed from prior sprints
Digital twin (farmos13) · scan v12 envelope · field intelligence v11 · weather
risk · soil.

## The honesty rule, mechanized
The gate forbids marking any predictive/market/banking/precision/multi-horizon
capability "live"; the agent gate forbids a declining agent from carrying non-zero
confidence. 31-assertion test enforces both.
