# SCAN_TO_DECISION_REPORT

## The flow (§3)
```
Scan
 → plant/crop result          (AgriculturalObjectClassifier + Plant.id)
 → health/pest result         (FarmBrainV2 envelope)
 → FarmBrain update           (ONLY if strong — P0 ingestion gate)
 → Daily Decision recalculated (DecisionHero re-reads FarmBrainState)
 → task created/updated        (decision.taskRef)
 → follow-up scheduled         (decision.followUpDate / outcome path)
```

## How "scan recalculates the decision" works (no extra wiring)
The scan chokepoint (`scanDetectionEngine._withFarmBrain`) already dispatches a
`scan` event into **FarmBrainState** — but ONLY for a strong scan (the P0
ingestion gate: plant-known + confidence ≥70 + trust + provider-auth + photo-
quality). `DecisionHero` subscribes to FarmBrainState via `useFarmBrainState`, so
the moment the state advances, the decision re-derives. One source of truth, one
recalculation path.

## Weak-scan handling (§3 rules — enforced)
- weak scans go to the **Review Queue only** — `FarmBrainScanIngestion` returns
  `shouldIngest:false` and the scan event is **not** dispatched.
- weak scans **cannot update FarmBrain** → the decision does not change.
- weak scans **cannot create an action task** (trust gate `allowTaskCreation`).
- **clear scans** advance FarmBrainState → DecisionHero produces/refreshes
  Today's Decision.

This is verified by the P0 gate `check:farmbrain-scan-ingestion` (build fails if
a weak scan can enter FarmBrain) — so the scan→decision path cannot regress into
acting on a weak photo.

## Acceptance (§11) — what is verified automatically
| Test | Result |
|---|---|
| New farm, no crop → CTA to add crop | ✅ (test) |
| Crop without stage → planting-date CTA | ✅ (test) |
| Clear scan → specific decision + linked task + outcome | ✅ (test) |
| Weak scan → no FarmBrain update, no action task | ✅ (P0 gate) |
| Duplicate same-day → identical dedupe key | ✅ (test) |
| No provider/AI jargon in the decision | ✅ (gate + test) |

The "complete task → Better/Same/Worse/Not sure" prompt (§4) and the live
Twi/French/Swahili label check are wired (labels localized across 6 locales);
localizing the dynamically-generated decision *sentence* is the next i18n step.
