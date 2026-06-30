# Pilot Metrics

Every metric the command center reads: definition · source · threshold. Numbers are populated by
real farmer activity — none are fabricated. The go/no-go engine (`launchGateDecision`) consumes the
bolded gate metrics.

## Funnel + engagement
| Metric | Definition | Source |
|---|---|---|
| Active farmers | distinct farmers with a session in the window | session / observability |
| New registrations | new accounts | auth |
| **Onboarding completion** | reached first-scan-ready state | onboarding events |
| Farm / crop / location added | funnel steps | farm-state events |
| First scan completed | farmer ran ≥1 real scan | `scanObservabilityEvent` |
| DAU | distinct daily actives | session |
| **Task completion rate** | completed / surfaced tasks | task events |
| **Recommendation acceptance** | accepted / shown recommendations | decision events |
| Marketplace / funding usage | listings / applications | market / funding events |

## Quality + reliability (gate metrics)
| Metric | Definition | Source | Gate (READY_FOR_1000 / COMMERCIAL) |
|---|---|---|---|
| **Crash-free sessions** | 1 − crashed/total | crash reporting | ≥0.99 / ≥0.995 |
| **Scan success rate** | confident usable result / total scans | `scanObservability` | ≥0.85 / ≥0.92 |
| Scan latency p50/p95/p99 | provider/scan latency | `providerReliability` | p95 ≤4s (commercial) |
| Retry / timeout rate | per `scanProviderMetric` | provider metrics | informs alerts |
| Confidence distribution | high/med/low bands | `scanObservability` | — |
| **Retention D7** | returned within 7 days | session | ≥0.30 / ≥0.40 |
| **Farmer satisfaction** | CSAT 0..1 (survey) | feedback | ≥0.70 / ≥0.80 |
| API uptime / offline sync | health + sync queue | health | informs stability |
| Translation coverage | locale parity | language gates | no raw keys |

## Pilot Health Score (0–100)
`computePilotHealthScore()` → Product Stability (crash-free) · Scan Reliability · Recommendation
Quality · Farmer Satisfaction · Performance (p95) → **Overall** (mean of measured components).
Components with no data read 0 / null — the score reflects *measured* reality, not a guess.

## Current values
**All zero / unmeasured** — no real production scans or farmers yet (the live provider cert reads
NOT_CERTIFIED; the scan lifecycle ladder reads DEVELOPMENT). The metrics populate the moment the
pilot begins.
