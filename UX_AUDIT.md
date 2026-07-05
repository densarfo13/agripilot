# UX_AUDIT.md — Scan result experience (2026-07-05)

Track A (UX + accessibility are allowed release work). Audits the ACTUAL current scan result
surface (post the 2026-07-05 low-confidence UX sprint, `SCAN_RESULT_UX_REPORT.md`) against the
Farroway OS v2 spec's Priority-1 bar. Disposition is honest: **done / exists / after-P0 / declined.**

## The 15 Priority-1 items

| # | Spec item | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Better confidence visualization | ✅ DONE | HIGH/MEDIUM/LOW pill beside the result title, colored, from the real `confidencePct` (server `confidenceLabel` wins as text). |
| 2 | Confidence meter | 🟡 PARTIAL | The badge conveys the band. A continuous meter is a small additive polish — safe, after-P0. |
| 3 | Camera quality tips | ✅ DONE | Five tips (daylight / fill frame / one leaf / avoid blur / no fingers) in ScanGuidanceCard, i18n'd ×6. |
| 4 | Cleaner typography / spacing / large buttons | ✅ DONE | Guidance CTAs ≥48px, full-width, high-contrast; result cards on the design-system card style. |
| 5 | Better treatment cards | 🟡 PARTIAL | Treatment renders curated organic-first guidance and hides on low confidence with an honest note. Visual restyle is after-P0 polish. |
| 6 | Previous-scan / disease comparison | ✅ EXISTS | `PhotoComparisonCard` (before/after pair) + scan history exist. Not yet inlined on the result screen (after-P0). |
| 7 | Field history / scan timeline | ✅ EXISTS | Farm timeline + scan history exist; `/api/scan/history` now returns per the W2 identity fix. A result-screen timeline strip is after-P0. |
| 8 | Save to Journal | ✅ EXISTS | Journal entry flow + follow-up task injection (`followUpTaskFor`) exist. |
| 9 | Progress indicator / animated analysis | 🟡 EXISTS (basic) | ScanStartupBanner shows staged analyzing states (3s/5s diagnostics). "Apple-camera" animation is after-P0 — see the timing note. |
| 10 | Share with Agronomist | ⛔ AFTER-P0 | New outward-facing send flow (permission + consent for farmer photo/data). Legitimate, but it is new surface area + a consented data egress — sequence after P0 + consent copy. |
| 11 | Download PDF Report | ⛔ AFTER-P0 | New capability (client PDF gen or server render). Non-trivial bundle weight; add after P0, ideally lazy-loaded so it never touches the farmer Home path. |

## The design bar ("Apple / Linear / Arc level, 60 FPS, smooth animations")
Directionally right, but the **timing is the point**: the scan RESULT screen is the exact surface
whose stability is the open P0 (a device still reaches the fallback after a 200). Adding animation
JS, a PDF generator, and a share sheet to that screen NOW increases its render surface and bundle
weight while we are trying to prove it renders reliably. The disciplined sequence:

1. Close Scan P0 (one on-device scan → result screen; capture via Export Diagnostic Report if it fails).
2. Land the measured main-chunk trim (PERFORMANCE_REPORT P1) so new polish has headroom.
3. THEN add the delight layer (animated analysis, confidence meter, result-screen timeline, PDF,
   share) — each lazy-loaded, each behind build:safe + a device smoke.

## Accessibility (spec: AA)
Present today: ≥48px touch targets on guidance CTAs, `aria-label`s on badge + CTAs, high-contrast
farmer copy, screen-reader region role on the guidance card. **Not yet verified:** a full WCAG-AA
contrast + focus-order + screen-reader pass across every scan surface. That is a bounded, safe
Track A task (no engine changes) and is the recommended next UX item after P0.

## Verdict
The farmer-facing low-confidence experience is production-quality TODAY (one clear next action, no
duplicate messages, honest confidence, localized). The remaining spec items are either already
present (reuse, don't rebuild) or genuinely new surface area that must wait behind the P0 gate —
not because they're wrong, but because shipping them onto the crash-prone result screen now would
trade the thing that matters (Scan reliability) for polish.
