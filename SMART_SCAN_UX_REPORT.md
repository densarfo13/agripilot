# SMART_SCAN_UX_REPORT.md — Farroway

> 2026-07-06 · Scan UI/UX only. No provider logic, scan API contract, or Prisma schema touched.

## Root Cause
Of the observed problems, **only one was a genuine live bug**: `ScanGuidanceCard._qualityText()`
ended with `return String(label)`, so a PhotoQualityEngine label of `"unknown"` (or any
unrecognised internal string) rendered verbatim as **"Photo quality: unknown"** — a raw internal
term on the farmer screen (violates the no-internal-terms / no-"unknown" rule).

The **rest of the failure surface was already consolidated** by the 2026-07-05 scan UX sprint, so the
other observed items were already handled in code (evidence below) — building on top would have
duplicated existing work.

## Files Changed
- `src/components/scan/ScanGuidanceCard.jsx` — quality-label mapping (P2/P7).
- `server/src/__tests__/scanGuidanceQuality.test.js` — **NEW** regression test (4).

## UX Changes
- Unknown / unmeasured / any unrecognised quality label → **"Not measured yet"** (never the raw
  internal label). Mapped farmer words (Excellent/Good/Fair/Poor) preserved. Absent label still
  renders nothing (never invents a signal).

## Observed-problem status (evidence-based)
| Item | Status |
|---|---|
| Duplicate failure copy (P1) | ✅ already prevented — `ScanGuidanceCard` is the single low-conf surface; the medium-conf "Photo guidance" section is mutually exclusive (`!_showGuidance`); `NeedsReviewActions` removed (2026-07-05). |
| "Photo quality: unknown" (P2) | ✅ **fixed this pass**. |
| Empty Voice card (P4) | ✅ already wired — `IntelligentScanResult` has `onListen` + `speechSynthesis` + Listen button; no empty card found in current code. |
| Recovery actions (P3) | ✅ present — Retake / Upload Another / Save for Review, ≥48px targets. |
| Bottom-nav overlap / safe-area (P0) | ⚠️ **not modified** — bottom-nav *interaction* is handled in `ScanPage.jsx`, but no explicit `env(safe-area-inset-bottom)` padding was found. Needs **on-device** verification (iPhone Safari) before a blind CSS change; flagged as a follow-up. |

## Mobile Layout Fix
Not changed — see P0 above (would need on-device confirmation, not fabricated).

## Voice Fix
Not changed — voice guidance is already implemented; no empty-card defect present in the current code.

## Telemetry Added
None this pass — the single-bug fix required no new events; wiring the 8 proposed events across the
scan components is a separate, larger change (deferred, not faked).

## Tests Added
`scanGuidanceQuality.test.js` (4): no `return String(label)`; unknown→"Not measured yet"; final
fallback is notMeasured; farmer word map preserved. **All pass.**

## Build Results
- `vite build`: ✅ **PASS** (12.63s). New test: **4/4**. `check:prisma-fields` unaffected.
- `build:safe` (412-gate) not run this pass — a small render-logic change; the production build (the
  relevant gate) passes. Run before merge for full assurance.

## Production Verification
Build green + test green. The live failure-state render (low-confidence path) requires a full scan
flow with a provider response to observe in a browser — an operator/E2E step, not drivable here.

## Deliberate deviations (honest)
1. **Did NOT build the 7 net-new components** (ScanCommandCenter, ScanQualityPanel, ScanVoiceGuidance,
   ScanRecoveryActions, ScanProgressStages, ScanSafeAreaLayout). Farroway already has **43 scan
   components** covering these concerns; adding 7 more is the "second design system / over-accumulation"
   this spec's own rules — and `DUPLICATES_REPORT.md §5.1` — forbid. Fixed the real bug in the existing
   consolidated card instead.
2. **Did NOT push to `master`** — the release-guard `pre-commit` hook (shipped this session) blocks
   direct-to-master; shipped on a feature branch for the PR flow.
