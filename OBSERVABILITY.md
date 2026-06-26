# OBSERVABILITY — v14 (honest status)

**Real in-app today:** dozens of `window.__*Health()` runtime probes, an API
health/diagnostics center, provider reliability scorecard + SLA definitions
(plant.id 4s, crop.health 5s, etc.), and the golden-dataset accuracy harness.

**Declared `requires_infra`:** distributed tracing, **OpenTelemetry, Prometheus,
Grafana, Sentry**, and hosted live dashboards. These are infrastructure integrations
(exporters + collectors + a metrics backend), not app logic. The in-app health
surface is the honest foundation an OTel/Prometheus stack would export from.

Provider SLA monitoring is real (definitions + reliability metrics); the dashboards
that visualize them at scale are the infra layer.
