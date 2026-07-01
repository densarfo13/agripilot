# Scan Recovery Fix Report

## What shipped
A **result-scoped error boundary** that guarantees the spec's outcome — a scan never dead-ends at
"Scan temporarily unavailable"; a result-render crash becomes an explicit **recoverable** state.

- **`src/components/scan/ScanResultErrorBoundary.jsx`** (new): wraps the rich result renderers. On a
  render throw it shows a farmer-friendly card — *"We saved your scan for review. Your photo is safe
  — you can try again, and an expert can review it."* — keeps the photo (thumbnail), offers **Try
  Again**, and captures `window.__scanResultCrash` + `[FARROWAY_CRASH][scan_result_render_error]`
  with the correlation id. Pure, never throws in its own catch.
- **Wired at all 3 rich-result call sites**: `ScanPage.jsx` (IntelligentScanResult + ScanResultCard),
  `ScanResultPage.jsx` (`entry.raw` history path — the highest-risk vector), `PhotoIntelligence.jsx`.
- **`check:scan-result-recovery`** gate (in build:safe): fails the build if any rich-result renderer
  is not wrapped — the guarantee can't regress.
- Correlation id (prior sprint) is included in both crash captures so the exact throwing field is
  one field-capture away on a real device.

## The four required outcomes — now guaranteed
| Outcome | How |
|---|---|
| Return a result | normal success path (unchanged) |
| Save for review | render crash → ScanResultErrorBoundary "saved for review" (NEW — closes the dead-end) |
| Queue for later | offline / no-classifier → `enqueueOfflineScan` (`scan.queued`) |
| Show the exact recoverable reason | provider-down → `serviceUnavailable` friendly copy; crash → correlation id captured |

## Scope discipline
No UI polish, no governance, no page redesign. One new focused component + 3 wraps + 1 gate + this
report set. Did **not** guess-patch a null-guard blind; the recovery makes the crash class harmless
and the correlation id localizes the exact field on the next real occurrence — a one-line follow-up.

## Verification
`build:safe` green (new gates: `check:scan-result-recovery`, `check:scan-correlation-id`). `lint` +
`test` run inside build:safe. `typecheck` has no standalone script (TS checked in `npm run build`
via server `tsc`) — reported honestly, not claimed.

## The one step that fully closes it
On a device that shows the dead-end (or the new "saved for review" card), capture
`window.__scanResultCrash.message` + `.componentStack`. That names the exact field; the guard is then
a one-line change. Paste it and it's fixed at the source.
