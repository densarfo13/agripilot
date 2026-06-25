# FIELD_VALIDATION

## Certified from code (no field needed)
Pipeline resilience, unknown/non-plant rejection, weak-scan gating, confidence
degradation, no-fabrication — all deterministic, all in CI.

## Requires the field (PENDING — cannot be done from the sandbox)
The Phase-1 dataset (20 crops / 15 fruits / 15 vegetables / 20 flowers / 10 trees
/ 15 diseases / 10 deficiencies / 15 insects / 5 mushrooms / unknowns) must be run
as **real photos against the live providers**. Fabricating those results is
forbidden (and gate-blocked). To execute:

1. Set provider keys on Railway (PLANT/CROP_HEALTH/INSECT/MUSHROOM/AMBEE).
2. `SCAN_API_BASE=… SCAN_API_TOKEN=… SCAN_IMAGE_DIR=… npm run scan:acceptance`.
3. Record per scan: plant accuracy, disease accuracy, confidence, latency,
   recommendation usefulness (the harness + observability table already capture these).
4. Collect pilot adoption metrics from `/admin/pilot-analytics` over the pilot window.

When that field evidence lands, the verdict recomputes from LIMITED PILOT toward
READY FOR 100 / 1000 FARMERS — automatically, from real numbers.
