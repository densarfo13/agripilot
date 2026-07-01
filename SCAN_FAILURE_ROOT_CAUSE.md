# Scan Failure — Root Cause

## Exact trigger
`src/components/scan/ScanErrorBoundary.jsx` renders `title="Scan temporarily unavailable"` from
`getDerivedStateFromError` — i.e. **a component in the scan tree threw during render.**

Two failure classes, only the first produces this string:
1. **Render-phase throw → "Scan temporarily unavailable"** (this bug). A result renderer
   dereferenced an unexpected result shape.
2. **Provider/network failure → graceful** (`serviceUnavailable` → "scan service is busy",
   `PlainUploadFallback` → "we saved your photo"). Works; not this bug.

## Most probable source (evidence-ranked)
1. **`ScanResultPage.jsx` → `<ScanResultCard result={entry.raw}>`** — `entry.raw` is a persisted
   history record. Old/partial entries (pre-schema, or saved from a degraded scan) can lack fields
   the renderer touches → throw. **Highest probability** (real user data, not fresh envelopes).
2. **`ScanPage.jsx` → `IntelligentScanResult` / `ScanResultCard`** with a fresh but atypical
   provider shape.
3. **`PhotoIntelligence.jsx`** secondary photo path.

## Why the exact line needs a device
The scan renderers are heavily guarded (`_str`/`_num`/`_isObj`, `Array.isArray` before `.map`,
`typeof x === 'string'` before `.toLowerCase()`). The throw is a shape the guards don't cover — it
only reproduces with the offending real result. The **captured evidence** pinpoints it:
```
window.__scanCrashDetails   // page-level: { correlationId, message, stack, componentStack }
window.__scanResultCrash    // result-scoped (new): { correlationId, message, componentStack }
```
Grep Railway for `[FARROWAY_CRASH][scan_result_render_error] <correlationId>`.

## Fix strategy (this sprint)
Rather than guess the field, make the crash **recoverable everywhere**: wrap each rich-result
renderer in a **result-scoped error boundary** that converts a render throw into a "we saved your
scan for review" state (keeps the photo, offers Try Again) — so the farmer **never** hits the
page-level dead-end. See SCAN_RECOVERY_FIX_REPORT.md.
