# SCAN_TRUST_GATE_REPORT.md

**Sprint #214 — scan trust gate.** Date: 2026-06-19.

Prevents bad scans from polluting Farroway. Off the frozen list; never
fabricates a diagnosis to unblock a scan.

## Trust gate rules (`evaluateScanTrust`)

Works off REAL result fields (confidencePct, topCandidates, plantName,
issueType, status) + the PhotoQuality verdict. Threshold = 70% (the
spec's 0.70).

| Output | Blocked when |
|---|---|
| `allowPlantCreation` | confidence <70 · no candidates · photo failed · plant unknown |
| `allowTaskCreation` | issue unknown (and plant unknown) · confidence <70 · status needs_review · nextAction=retake · photo failed |
| `allowFarmBrainIngestion` | confidence <70 · status unclear · plant unknown · photo failed |
| `allowTimelineWrite` | follows FarmBrain ingestion |
| `allowRecentScanDisplay` | follows FarmBrain ingestion |
| `allowReviewSave` | always when a photo exists |

`gateStatus`: `trusted` (all clear) · `review` (blocked but has photo →
review queue) · `blocked` (no photo). Errors fail SAFE → `review`.

## What changed in the UI

- **Add to My Plants** (`scan-intel-save-plant`) now requires
  `_trust.allowPlantCreation` — never renders for an unidentified scan.
- **Create Task** (`scan-intel-create-task`) now requires
  `_trust.allowTaskCreation`.
- When blocked, the CTAs are replaced by the **photo coach card**
  (`scan-photo-coach-card`): "We could not identify this plant yet" +
  what-went-wrong + one instruction + Retake / Upload / Save-for-Review.

## Health
`__scanTrustGateHealth()` → trustGateReady, unknownPlantBlocked,
taskCreationBlockedForUnknown, farmBrainProtected, thresholdPct:70.

Build gate: `check:scan-trust-gate`.
