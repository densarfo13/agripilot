# Scan Production Fix Report

## The canonical state machine (this sprint)
`src/runtime/scan/resolveScanTerminalState.ts` — pure, total, never throws. Maps **any** scan
outcome to exactly **one of the 11 required states**, so a scan can never dead-end:

`SUCCESS_IDENTIFIED · SUCCESS_HEALTH_ISSUE · BAD_IMAGE · NO_PLANT_DETECTED · LOW_CONFIDENCE ·
PROVIDER_UNAVAILABLE · AUTH_FAILED · RATE_LIMITED · UPLOAD_FAILED · QUEUED_FOR_REVIEW · SAVED_FOR_RETRY`

Each result carries a **farmer-facing message** (no provider/API/model/exception wording) + recovery
affordances (`canRetry`, `canUpload`, `canSaveForReview`). Ultimate fallback = `SAVED_FOR_RETRY`
(photo kept), never a dead-end. 38-assertion adversarial test + `check:scan-terminal-state` gate.

## P0 SAFETY LOCK — enforced
`mayMutateFarm` is **true only for confident `SUCCESS_IDENTIFIED` / `SUCCESS_HEALTH_ISSUE`**. Every
failure / low-confidence / queued state → `false` (no add-plant / crop / task / FarmBrain /
recommendation / farm-health overwrite). Test asserts this across 9 non-success inputs.

## Recovery stack (this + prior 2 sprints)
1. **Correlation id** on every scan failure (`scanCorrelationId`) → ties client crash to Railway log.
2. **Result-scoped error boundary** (`ScanResultErrorBoundary`) at all 3 rich-render sites → a
   result-render throw becomes "We saved your scan for review", never the page-level dead-end.
3. **Terminal-state machine** (this sprint) → every outcome is a named, farmer-safe state.

## Provider (verified real)
`PLANT_ID_API_KEY` → `https://plant.id/api/v3/identification` (`plantIdProvider.js`), read directly,
no fake fallback. Failures already classified (auth/credits/429/timeout/5xx) → these map cleanly onto
`AUTH_FAILED` / `RATE_LIMITED` / `PROVIDER_UNAVAILABLE`.

## Honest scope
No governance, no page redesign, no fake readiness. One real engine + test + gate + the recovery
wiring from prior sprints. The exact render-throw field is captured on the next real device scan; the
terminal-state machine means the farmer is safe regardless.
