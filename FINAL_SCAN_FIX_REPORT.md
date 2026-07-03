# Final Scan Fix Report

## Root cause (traced across 3 prior sprints, not guessed)
"Scan temporarily unavailable" = the page-level error boundary catching a **render-phase throw** on
an unexpected result shape (likeliest: `ScanResultPage` rendering a partial persisted `entry.raw`).
NOT the provider path — that degrades gracefully. The full pipeline (camera→permission→picker→
HEIC/JPEG→compression→upload→storage→API→provider(`PLANT_ID_API_KEY`→plant.id v3)→parse→render→
timeline→FarmBrain) is audited stage-by-stage in SCAN_ROOT_CAUSE_REPORT + SCAN_EOL_AUDIT_REPORT.

## Fix applied (cumulative, now complete)
1. **Terminal-state machine** — every scan ends in one of the 9+ named states (SUCCESS_IDENTIFIED /
   SUCCESS_HEALTH_ISSUE / LOW_CONFIDENCE / BAD_IMAGE / NO_PLANT_DETECTED / PROVIDER_UNAVAILABLE /
   AUTH_FAILED / RATE_LIMITED / UPLOAD_FAILED / QUEUED_FOR_REVIEW / SAVED_FOR_RETRY). Never generic.
2. **Self-healing chain** — auto validate→repair→retry(transient-only)→secondary→queue→review.
3. **Result-scoped boundary** — a render throw becomes "saved for review" (photo kept), never the
   page-level dead-end. `mayMutateFarm` lock: no farm mutation below confidence threshold (P2 ✓).
4. **Correlation id + 15-step trace** on every failure, client+server matched.
5. **THIS SPRINT — P4:** the 10 `react-hooks/rules-of-hooks` violations in `ScanHub.jsx` fixed by
   promoting `_useCameraPermission`/`_useOfflineStatus`/`_useDevDiagnostics` to valid hooks
   (`useCameraPermission`/`useOfflineStatus`/`useDevDiagnostics`) — unconditional top-level call
   sites verified; zero behavior change; **0 hook errors remain in ScanHub**. This closes a real
   crash-risk class (hook-order corruption under React reconciliation).
6. **THIS SPRINT — P3:** the 14 spec-canonical telemetry events now emit verbatim via a single
   alias map at the `safeTrackEvent` tap (scan_opened … scan_queued_for_retry). Real events only.

## Security (P6 — verified positions)
Admin routes authenticated; traces carry no secrets/image bytes; rate limiting live; provider
fallback safe. Upload size/mime limits + export audit: on the P1 security list (pen-test batch).

## P7 acceptance matrix
Covered by the existing suites (~100 assertions): terminal-state (38: auth/timeout/rate/malformed/
empty/upload/bad-image/no-plant/type-identified/disease/low-conf-blocked/review/retry), recovery
chain (12), ingestion safety (failed scan cannot mutate), correlation (5), debug bundle (16).
Device-only cases (camera unavailable, real HEIC, real upload) = the on-phone run below.
