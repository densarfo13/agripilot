# FARMBRAIN_SCAN_WIRING_REPORT — P0 §6 / §7

## The gate
`src/runtime/farmBrain/FarmBrainScanIngestion.ts` is the single decision between
a scan and FarmBrain. A scan updates FarmBrain **only if it clears every gate**:

| Condition | Source |
|---|---|
| plant known | scan result has a real candidate (not Unknown/unclear/needs_review) |
| confidence ≥ 70% | FarmBrainV2 `confidenceScore` |
| trust gate passed | `evaluateScanTrust().allowFarmBrainIngestion` |
| provider auth ok | result came from a real provider (not the rule fallback) |
| photo quality not failed | PhotoQuality verdict |
| not review-only | scan status not "review"/"unclear" |
| provider available | not unavailable/serviceUnavailable |

On any failure → `shouldIngest:false` with explicit `blockers`, and the scan
chokepoint **skips the FarmBrain dispatch**. The scan is held for review; the
canonical FarmBrain state never sees it.

## Wiring (no bypass)
`scanDetectionEngine._withFarmBrain()` is the single chokepoint both result
exits pass through. It now:
1. builds the FarmBrainV2 envelope + scan-type decision (as before),
2. computes the ingestion decision (`decideFarmBrainIngestion`),
3. attaches `farmBrainIngest` to the result (observability), and
4. dispatches the `scan` event to FarmBrain **only when `shouldIngest` is true**.

Previously the dispatch was unconditional; it is now gated. This is the
"no weak scan enters FarmBrain" guarantee, enforced by
`check:farmbrain-scan-ingestion`.

## Ingestion updates (RULE 6)
A strong scan is cleared to update: crop, health, risk, disease, pest,
growthStage, todayTask, timeline, dataQuality, farmBrainConfidence.

## Task generation safety (§7)
Task creation already routes through the trust gate
(`allowTaskCreation`): no generic task is created from an unclear scan. The
ingestion gate adds the same confidence-≥70 + plant-known floor for FarmBrain's
`todayTask`, so a low-confidence scan produces neither a FarmBrain task nor a
plant.

## What does NOT update FarmBrain
unclear scan · auth failure · provider unavailable · confidence < 70 ·
review-only scan · failed photo quality. Each is an explicit `blocker` visible
in `window.__farmBrainIngestionHealth().lastBlockers`.

## Health
`window.__farmBrainIngestionHealth()` → `{ confidenceMinPct:70, evaluated,
ingested, held, lastBlockers, weakScanBlocked:true }`.
