# SCAN_PERFORMANCE_REPORT

Latency is recorded per call and surfaced as p50/p95/p99 per provider in the 24h
reliability scorecard. SLA ceilings (from the certifier): Plant.id 4s · Crop.health
5s · Insect.id 4s · Weather 1s · Soil 2s · Mushroom 5s.

Performance numbers are measured from `scan_provider_metrics`, not asserted — there
are none in the sandbox (NO_DATA). They accrue from live scans on Railway.
