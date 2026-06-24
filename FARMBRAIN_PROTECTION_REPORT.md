# FARMBRAIN_PROTECTION_REPORT.md

**Sprint #215 §4 — FarmBrain memory protection.** Date: 2026-06-19.

## Ingestion contract

A scan is written to FarmBrain / journal / timeline ONLY when ALL hold:
- trust gate `allowFarmBrainIngestion` = true (confidence ≥70, plant
  identified, status not needs_review, photo not failed)
- photo quality ≥ 75 when a real quality score exists

Otherwise `shouldIngestScan` returns:
```
{ ingest:false, skipped:true,
  skipReason:'FarmBrainIngestionSkipped:<reason>',
  memoryRejectedReason:<reason>,   // e.g. quality_below_75, low_confidence
  toReviewQueue:true }
```
and the core `persistScanToJournal` bridge skips the write (the scan is
routed to the review queue instead of polluting memory).

## Why this matters
FarmBrain confidence + recommendations are only as good as the scans
they ingest. Filtering low-confidence / poor-quality scans at the
ingestion boundary keeps the memory clean — and the rejection is
explainable (`memoryRejectedReason`), never silent.

## Health
`__farmBrainIngestionHealth()` → farmBrainProtected, lowConfidenceBlocked.
`__pilotReadinessDashboard().farmBrainConfidence`.
Gate: `check:farmbrain-memory-quality` (+ `check:farmbrain-ingestion-safety` #214).
