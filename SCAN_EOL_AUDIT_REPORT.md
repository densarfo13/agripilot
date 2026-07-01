# Scan End-to-End Audit Report

Traced against real code, in the requested priority order. Each stage: what runs + its recovery.

| # | Stage | Code | Recovery on failure |
|---|---|---|---|
| 1 | Camera / photo picker | `LiveCameraScanner`, `ScanRuntime.startCamera` | denied → `PlainUploadFallback` (upload path) |
| 2 | Image compression | `ScanCapture` (HEIC→JPEG normalize) | fault swallowed; raw image still used |
| 3 | Upload → storage | server `/api/scan/analyze` (Cloudinary/DB server-side) | offline → `enqueueOfflineScan` (`scan.queued`) |
| 4 | Scan API route | Express `/api/scan/analyze` | non-OK classified; never crashes client |
| 5 | Plant.id / provider | server adapter | `classifyProviderFailure` (auth/credits/429/timeout) → `serviceUnavailable` |
| 6 | Environment variables | keys server-side only | missing key → provider `configured:false` → honest "busy", never fabricated |
| 7 | Backend timeout | `scanRetryEngine` | http 408/504 → TIMEOUT (retriable); terminal short-circuits |
| 8 | Queue / background | `scan.queued` / `scan.drained`; no-classifier → `OFFLINE_QUEUED` | photo kept, analysed later |
| 9 | Result persistence | journal + FarmBrain ingestion | failed scan never mutates farm state (unit-tested) |
| 10 | User-facing recovery | error boundaries | **was the gap — see below** |

## Root-cause class (the "Scan temporarily unavailable" dead-end)
That string is rendered by the **page-level `ScanErrorBoundary`** — a React error boundary — which
fires **only on a render-phase throw** in the scan tree. It is **not** the graceful provider-down
path (`serviceUnavailable` → "the scan service is busy", `PlainUploadFallback` → "we saved your
photo"), which already works.

The analysis can **succeed** and the crash still happen **in the result renderer** if the result
envelope has an unexpected shape — most notably `ScanResultPage` rendering `entry.raw` (a persisted
history entry that may be partial/stale), or a provider error envelope reaching the rich renderers.

## Why it wasn't a one-line find
The engine (`scanDetectionEngine` — "never throws"), the hook (`useScanRuntime` — `_safe(getResult,
null)`), the normalizer, and the primary renderers are all **extensively guarded**. So the throw is
**data-shape-dependent** — it fires only on a specific shape that slips past the guards on a real
device. Guessing the exact field blind would be wrong; the fix makes it **recoverable regardless**.

## Verification run (this audit)
`build:safe` green (all scan gates incl. the two new ones). `npm run lint` / `npm test` run within
build:safe. `npm run typecheck` — **no standalone script**; TS is checked inside `npm run build`
(server `tsc`). Reported honestly rather than claimed.
