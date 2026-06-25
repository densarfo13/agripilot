# AMBEE_POLLEN_USAGE_AUDIT

**Finding: Farroway has NO Ambee Pollen integration. Nothing to migrate.**

| Search term | Result |
|---|---|
| `pollen` (code) | 1 hit — a crop **agronomy knowledge** string in `cropRiskPatterns.js` ("Pollen viability collapses under water stress"). NOT an API. |
| `ambee` (code) | The **Soil** API only: `server/src/services/soil/ambeeSoilService.js` (`AMBEE_API_KEY`, `api.ambeedata.com/soil/latest/by-lat-lng`). |
| `pollenForecast` / `pollenRisk` / `allergy` / `genus` | 0 hits. |
| `AMBEE_POLLEN*` env vars | 0 references. |
| `src/runtime/environment/` | Did not exist (created this sprint). |

**Conclusion:** there is no deprecated Ambee Pollen endpoint to remove. The real
Ambee dependency is **Soil**. Per the founder decision, this sprint hardens Soil
and builds the pluggable EnvironmentOrchestrator instead of a speculative pollen
integration. Pollen is registered as a **disabled stub** — never fabricated.
