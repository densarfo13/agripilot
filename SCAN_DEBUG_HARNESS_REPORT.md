# Scan Debug Harness Report

A production debug harness to capture the **exact on-device failing step** of a scan on
farroway.app. Non-invasive: taps the existing telemetry sink; the scan engine is not refactored.

## What shipped
- **`src/lib/scanTraceRecorder.js`** — records the 15 canonical steps into `window.__scanTrace`,
  exposes `window.__lastScanCorrelationId` + `window.recordScanStep` + `window.exportScanDebug()`.
  Pure helpers (`mapTelemetryToStep`, `deriveTraceSummary`, `buildScanDebugBundle`) are unit-tested;
  the failing step is derived (explicit `fail`, else the step after the last one reached).
- **`src/lib/analytics.js`** — one-line tap in `safeTrackEvent`: every `scan*` telemetry event
  mirrors into the trace. Always-on capture, never throws, never blocks, no engine change.
- **`/admin/scan-debug`** (`src/pages/admin/ScanDebugPage.jsx`, admin-only via `RoleRoute`) — shows
  the 15 steps with pass/fail/pending, the captured render crash (`window.__scanResultCrash`),
  device/browser, and an **Export Debug JSON** button (downloads + copies). The export bundles the
  client trace **and** a fetch of `/api/admin/scan/last-trace`.
- **Server** — `/api/admin/scan/last-trace` now returns `correlationId` (echoes the client id passed
  as `?cid=`), so the exported client trace and server trace are matched. No secrets, no image bytes.

## The 15 traced steps
camera_opened · photo_selected · image_type_detected · image_compression_started/completed ·
upload_started/completed · image_url_created · scan_api_called · provider_called ·
provider_response_received · provider_response_parsed · diagnosis_normalized ·
result_render_started/completed.

## Captured on failure
`error.message`, React `componentStack` (via `__scanResultCrash`), browser (UA/platform/language),
device (size/DPR/touch), image type/size, HTTP status, and the `correlationId`.

## Globals
`window.__scanTrace` · `window.__scanResultCrash` · `window.__lastScanCorrelationId` ·
`window.exportScanDebug()` · `window.recordScanStep(step, ctx)`.

## Acceptance — operator step (cannot run from this environment)
1. Open `/admin/scan-debug` on iPhone Safari (admin login).
2. Run one real scan. If it fails, return to `/admin/scan-debug` → **Export Debug JSON**.
3. The JSON's `failingStep` + `crash.message` + `crash.componentStack` name the exact failure. Send
   it and the render-throw becomes a one-line source fix.

## Build
`build:safe` green (new gate `check:scan-debug-harness`); vite build clean. lint's pre-existing
react-hooks errors unchanged; no standalone typecheck (TS in `npm run build` via server tsc).
