# GOLDEN_DATASET_REPORT

A regression harness for scan ACCURACY. Verified images + ground truth live in
`golden-dataset/manifest.json`; `npm run golden:dataset` runs each through the
deployed scan API, measures plant + disease accuracy, and **rejects a run whose
accuracy decreased** vs `golden-dataset/baseline.json`.

## Status: PENDING population
The target is **1000+ verified images** (crops/fruits/flowers/weeds/trees/
vegetables/mushrooms/insects/diseases + unknowns). The manifest ships empty —
accuracy is NEVER fabricated, so an empty dataset reports PENDING (allowed).

## To activate (operator)
1. Add verified images + entries to `golden-dataset/manifest.json`.
2. `SCAN_API_BASE=… SCAN_API_TOKEN=… npm run golden:dataset` (records baseline).
3. Run it after every deploy; a drop in accuracy fails the check.
