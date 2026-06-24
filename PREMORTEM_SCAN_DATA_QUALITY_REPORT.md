# PREMORTEM_SCAN_DATA_QUALITY_REPORT.md

**Sprint #214 — scan data-quality premortem.** Date: 2026-06-19.

The screenshot failures, and how each is now prevented:

| Failure (screenshot) | Prevention |
|---|---|
| Unknown plant → "Add to My Plants" | trust gate hides Save-plant unless `allowPlantCreation` |
| `needs_review` shown as raw category | UI shows the coach card / "We could not identify…", never the raw token |
| Create Task on an unclear scan | Create-Task hidden unless `allowTaskCreation` |
| Recent Scans full of "Unclear photo" | RecentScansCard filters to trusted rows; rest collapse into "Review Queue (N)" |
| FarmBrain polluted by low-confidence scans | persistence bridge consults `__farrowayShouldIngestScan`; blocked scans skip the journal (`FarmBrainIngestionSkipped`) and route to the review queue |
| No photo-quality coaching | photo coach card with what-went-wrong + one instruction |

## Review queue behavior
Blocked-but-photographed scans → `ScanReviewQueue` (localStorage,
status pending_review → reviewed/discarded/promoted_to_plant). They do
NOT appear in Recent Scans and do NOT affect FarmBrain. Promotable only
if confidence is later fixed.

## Health check output (structural)
```
__scanTrustGateHealth        trustGateReady · unknownPlantBlocked · farmBrainProtected
__photoQualityHealth         photoQualityReady · neverFabricatesSubScores
__scanReviewQueueHealth      reviewQueueReady · recentScansClean
__farmBrainIngestionHealth   farmBrainProtected · lowConfidenceBlocked
```

## Verdict
**READY_FOR_PILOT (scan data quality).** Bad photo → coaching + review
queue. Good photo → plant/candidates + issue + action + follow-up.
Nothing fabricated. 4 gates lock it.
