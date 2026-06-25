# SCAN_CONSENSUS_REPORT

## What it merges (§6)
`ScanProviderConsensus.buildScanConsensus(scanResult)` merges plant identity +
crop.health + insect + mushroom into ONE diagnosis:
`{ plantIdentity, health, pest, mushroomWarning, confidence, reason,
recommendedAction, toReviewQueue, healthCheckAvailable, providers }`.

## Rules (enforced + tested — 12 assertions)
- No provider finding below 70% confidence creates an action → it goes to the
  review queue.
- No disease/treatment shown if crop.health returned no result.
- No mushroom edible/safe claim — ever.
- The result ALWAYS includes a confidence + a reason.
- Provider failure degrades gracefully (`healthCheckAvailable=false` →
  "Health check unavailable", scan still works).

## FarmBrain ingestion (§7)
Unchanged from the P0 ingestion gate: FarmBrain ingests only known plant/crop +
confidence ≥70% + trust + provider auth + photo quality. It never ingests
unknown / needs_review / provider failure / low confidence / a mushroom safety
claim. The consensus `toReviewQueue` aligns with that — weak results never enter
FarmBrain.

## Health
`window.__scanConsensusHealth()` → `{ confidenceMin:70,
neverMushroomSafeClaim:true, noDiseaseWithoutResult:true, built, toReview }`.

## Final verdict: MULTI_PROVIDER_READY_FOR_PILOT (pending live keys)
Consensus + adapters + safety are built, gated (4 gates + 12-assertion test),
and deployed. Live readiness is measured by the per-provider scan run on Railway.
