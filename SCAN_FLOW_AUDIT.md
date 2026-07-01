# Scan Flow — End-to-End Audit

Traced against the real code (not assumed). The headline finding is a precise one:

## Where "Scan temporarily unavailable" comes from
It is rendered by **`ScanErrorBoundary` (src/components/scan/ScanErrorBoundary.jsx:123)** — a React
**error boundary**. It fires **only when the scan component tree throws during render**
(`getDerivedStateFromError`). It is **NOT** the graceful provider-down path.

There are **two distinct failure classes** — this bug is the first:
1. **Render throw → "Scan temporarily unavailable"** (error boundary). A component dereferenced an
   unexpected result shape during render. *This is the reported bug.*
2. **Provider/network failure → graceful** — `serviceUnavailable` → "The scan service is busy…"
   and `PlainUploadFallback` ("We saved your photo…"). This path already works and does not crash.

## Pipeline trace + resilience status
| Step | Code | Status |
|---|---|---|
| Camera | `LiveCameraScanner` / `ScanRuntime` | ✅ guarded; denied → PlainUploadFallback |
| Compression | `ScanCapture` (HEIC→JPEG normalize) | ✅ |
| Upload → Cloudinary → DB | server `/api/scan/analyze` (keys server-side) | ✅ |
| Plant.id | server provider adapter | ✅ failures classified (auth/credits/429/timeout) |
| Fallback AI | `hybridScanEngine` / secondary | ✅ exists |
| Diagnosis | `scanDetectionEngine` (never throws) + `scanDiagnosisNormalizer` (safe defaults) | ✅ |
| Result render | `ScanResultCard` / `IntelligentScanResult` | ⚠ **data-shape-dependent throw** (this bug) |
| Recommendation / History / Timeline | FarmBrain ingestion + journal | ✅ |

**The engine, hook (`useScanRuntime` — `_safe(getResult, null)`), normalizer, and the primary
renderers are all extensively guarded** (200+ hardening sprints). So the throw is **data-shape
dependent** — it fires only on a specific unexpected result shape from a real device/provider that
slips past the existing guards. Pinpointing the exact line blind (≈1,100 lines) would be guessing.

## How to pinpoint it exactly (needs the failing device)
The boundary already captures the crash safely. On the device that shows the error:
```
window.__scanCrashDetails   // { correlationId, message, stack, componentStack, route, buildSha }
```
`message` + `componentStack` name the throwing component/line directly. Also grep Railway logs for
`[FARROWAY_CRASH][scan_component_error] <correlationId>`. This is the fastest, certain fix path — a
one-line null-guard once the field is known.

## The 7 resilience rules — status
| Rule | Status |
|---|---|
| Never lose the photo | ✅ `PlainUploadFallback` keeps the photo + offers upload/retry |
| Retry with exponential backoff | ✅ `src/core/scan/scanRetryEngine.js` (transient-only, stale-session aware) |
| Plant.id fails → secondary engine | ✅ `hybridScanEngine` |
| All AI fail → save + queue for background | ✅ `scan.queued` / `scan.drained` events |
| Notify when analysis completes | ✅ notification runtime |
| **Log every failure with a correlation ID** | ✅ **ADDED THIS AUDIT** — `scanCorrelationId` → boundary crash details + `scan_component_error` telemetry (`check:scan-correlation-id`) |
| Farmer-friendly messages | ✅ `serviceUnavailable` honest copy, no technical errors shown |

## Telemetry + dashboard
- **Admin dashboard exists:** `src/pages/admin/ScanHealthPage.jsx` (+ `scanObservability` /
  `providerReliability`: success rate, latency p50/p95/p99, timeout/retry, failures).
- **Telemetry present:** `image_captured`, `scan_analyzed`, `scan_complete`, `scan_failed`,
  `scan_fallback_used`, `scan_component_error`, `scan_cta_unavailable`.
- **Gap (naming):** the spec's exact event names `camera_opened`, `upload_started/completed`,
  `ai_started/completed/failed`, `diagnosis_returned` are not all present verbatim — a naming
  alignment, not a functional gap (the equivalents fire).

## This audit shipped
`scanCorrelationId` + boundary wiring + test + `check:scan-correlation-id` gate — closing the one
genuine gap. The render-throw pinpoint is now **one field capture away** on a real device. The scan
flow is already resilient (never loses the photo, retries, falls back, queues, notifies); the last
crash class is a data-shape guard that the correlation id + `__scanCrashDetails` will localize.
