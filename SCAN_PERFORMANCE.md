# SCAN_PERFORMANCE

## SLA latency ceilings (enforced by the certifier)
| Provider | Max latency |
|---|---|
| Plant.id | 4 s |
| Crop.health | 5 s |
| Insect.id | 4 s |
| Weather | 1 s |
| Soil | 2 s |
| Mushroom.id | 5 s (optional) |

A provider whose live call exceeds its ceiling is **not READY** (failureReason
`sla_exceeded`). Latency is captured per call and rolled over the recent window
(providerHealthMonitor) so the scorecard reflects sustained behaviour, not one call.

## Measured, not asserted
Live latency/confidence/success-rate come from `POST /api/admin/scan/certify`
against the deployed providers — PENDING until that run executes on Railway with
keys. No latency or success number is fabricated here.
