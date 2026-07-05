# Client Diagnostics — capturing the post-200 scan failure

The scan server path is healthy (`/api/scan/analyze` → 200) but some devices still reach the
fallback screen after the 200. Client analytics posts return 200 and persist **nothing** server-side,
and the exception lived only in memory (lost on reload). This makes the exact client exception
capturable and farmer-exportable.

## Files changed
- **NEW** `src/lib/clientDiagnostics.js` — persisted diagnostics core. `installClientDiagnostics()`
  attaches `window.onerror` + `unhandledrejection`; `recordDiagEvent()` keeps a rolling 200-entry
  lifecycle buffer; `recordDiagException()` persists each exception (message, stack, componentStack,
  correlationId, scanId, route, phase, timestamp) to `localStorage` (survives reload);
  `buildDiagnosticReport()` / `getReportJSON()` assemble the export. SSR-safe, never throws.
- **NEW** `src/components/system/DiagnosticExportButton.jsx` — the farmer-facing
  **"Export Diagnostic Report"** control + sheet (selectable textarea, Copy, Share, Download).
- `src/main.jsx` — `installClientDiagnostics()` at boot (early, before app render).
- `src/lib/analytics.js` — `safeTrackEvent` mirrors every event into the lifecycle buffer (the
  central sink; `analyticsStore.trackEvent` and `core/analytics.trackEvent` both forward here).
- `src/components/scan/ScanErrorBoundary.jsx` — `componentDidCatch` persists the exception
  (phase `scan-render`); fallback already renders the export button (via PlainUploadFallback).
- `src/components/scan/ScanResultErrorBoundary.jsx` — `componentDidCatch` persists the exception
  (phase `result-render`) + renders the export button in its "saved for review" fallback.
- `src/components/scan/PlainUploadFallback.jsx` — renders `<DiagnosticExportButton>` on the
  "Scan temporarily unavailable" screen.
- `src/i18n/columns/T-{en,fr,sw,ha,tw}.js` — `scan.diag.*` strings (13 keys × 5 launch locales).

## Diagnostics added
Persisted to `localStorage` (`farroway_diag_exceptions_v1`, `farroway_diag_events_v1`), exported as
one JSON `farroway-diagnostic-report/v1`:
- **exceptions[]** — every uncaught error: `message`, `stack`, `componentStack`, `correlationId`,
  `scanId`, `route`, `phase` (`scan-render` / `result-render` / `runtime` / `promise`), `source`,
  `ts`, and the 25 events preceding the crash.
- **lastEvents[]** — the last 200 lifecycle events.
- **lifecycle** — the same events bucketed into `render` / `upload` / `analyze` / `resultRender`.
- **scanTrace** (15-step pipeline), **scanResultCrash**, **lazyLoadError**, **correlationId**, **scanId**.
- **device** — userAgent, platform, vendor, language(s), online, standalone PWA, connection,
  viewport, screen, timezone, plus `isIOS` / `isSafari`.

Console access: `window.__farrowayDiagnostics.json()` or `window.exportFarrowayDiagnostics()`.

## How to reproduce
1. On the failing device, open **farroway.app** and run a scan that hits the fallback
   ("Scan temporarily unavailable" or "We saved your scan for review").
2. The exception is now captured automatically and persisted (it survives a reload).

## How to export the report (iPhone Safari verified path)
1. On the fallback screen, tap **"Export Diagnostic Report"**.
2. In the sheet: tap **Copy** (clipboard, with a select-the-textarea fallback for older iOS), or
   **Share** (iOS share sheet → Mail / Files / AirDrop), or **Download** (desktop).
3. Send the JSON to the team. It contains the exact `message` + `stack` + `componentStack` +
   `correlationId` + `scanId` + `phase` — i.e. the exact runtime exception and where it fired.

Business logic is unchanged — this is instrumentation only. A concrete defect surfaced by an
exported report is the trigger for any code change.
