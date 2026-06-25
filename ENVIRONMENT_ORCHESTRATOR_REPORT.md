# ENVIRONMENT_ORCHESTRATOR_REPORT — Architecture

One seam between environmental data and FarmBrain. Providers plug in by priority;
FarmBrain reads ONE merged envelope and nothing else, so new providers are added
without touching FarmBrain.

## Provider priority + failover order
| Priority | Provider | Status | Notes |
|---|---|---|---|
| 10 | **soil** | ✅ production (first) | Real Ambee Soil call (server-side, keyed). |
| 20 | weather | ✅ production | Derives from request context (no extra call). |
| 30 | air_quality | ◻ open slot | Pluggable; not yet implemented. |
| 40 | **pollen** | ⊘ disabled stub | No live dependency — never fabricated. |
| 50 | satellite | ◻ open slot | Pluggable; honest stub doctrine. |

Failover order: `weather → soil → air_quality → pollen → satellite`. A provider
that fails yields an honest `unavailable` result and **lowers confidence** — it
never blocks. New domains (Pollen, Air Quality, Satellite, even the scan
providers) implement `EnvironmentProvider` and `registerEnvironmentProvider()`.

## Resilience
- **Retry:** one retry on transient errors only (timeout / 429 / 5xx).
- **Circuit breaker:** 3 consecutive failures → provider skipped for 60s (`circuit_open`).
- **Timeout:** 6s AbortController on the Soil call.
- **Cache:** Soil cached 6h per ~1km grid (dedupes per location/day).
- **Graceful degradation:** `runEnvironment()` always returns a recommendation,
  even with zero providers. FarmBrain is never blocked (`blocksFarmBrain:false`).

## FarmBrain integration
The merged envelope feeds flowering/pollination guidance, spray timing, disease
pressure, irrigation timing, and **daily-decision confidence** (reduced when
signals are missing). No farmer ever sees a provider/API name (gate-enforced).

## Health + endpoints
- `__environmentProviderHealth()` · `__ambeePollenHealth()` · `__farmBrainEnvironmentHealth()`
- `GET /api/environment/diagnostics` (admin-auth; per-provider readiness, fingerprint only)
- `GET /api/environment/health` (public; readiness booleans only — no secrets)
