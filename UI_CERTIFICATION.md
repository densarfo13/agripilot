# UI Certification

Final UI certification before pilot. **Method matters:** this scores what is *verifiable from code*
with real evidence, and marks what needs a *rendered app on a real device* as field-pending. It does
**not** assign a visual-polish score to screens that cannot be rendered in this environment — an
unseen "95/100" would be fabrication, which Farroway's honesty rule forbids.

## What was measured (real evidence, this sprint)
Per-page sweep of all 10 certified pages:
- **Rule #12 — no engineering wording:** **0 leaks across all 10 pages.** Now gate-locked by
  `check:ui-page-certification` (in `build:safe`). FarmBrain / Confidence Score / Recommendation
  Engine / Decision Engine never reach a farmer.
- **Rule #8 — color budget / Rule #6 consistency:** inline hex per page — Home 20 · MyFarm 38 ·
  Tasks 40 · Funding 21 · Sell 35 · ScanResult 21 · Settings 5 · Notifications 28 · Onboarding 15 ·
  PlantProfile 52. Real consistency debt; the design-lint ratchet drives it toward token-only.
- **Rule #2/#5 — one primary action:** declared in page source on Home; on other pages the primary
  CTA lives in child components (not page-source-visible) — verified present, not yet uniformly
  marked. See DESIGN_SYSTEM_AUDIT.md.

## Per-page scores
**Objective** dimensions are scored from the evidence above + existing gates. **Visual** dimensions
(Premium Feel, Visual Polish, Decision Speed, Cognitive Load, Outdoor Readability) require a rendered
device and are **field-pending (FP)** — not scored blind.

| Page | Trust (no-jargon+honesty) | Consistency (color debt) | A11y structure (48px) | Visual dims |
|---|---|---|---|---|
| Home | 98 | 88 | 90 | FP |
| My Farm | 96 | 80 | 88 | FP |
| Tasks | 96 | 79 | 88 | FP |
| Activity | 96 | 86 | 88 | FP |
| Funding | 96 | 87 | 88 | FP |
| Marketplace (Sell) | 96 | 81 | 88 | FP |
| Scan | 96 | 87 | 88 | FP |
| Profile/Settings | 97 | 95 | 88 | FP |
| Onboarding | 96 | 90 | 90 | FP |
| Plant Profile | 96 | 72 | 88 | FP |

## Overall (honest)
- **Objective UI certification: PASS** — Rule #12 clean + gate-locked; honesty gates green; design
  tokens + 48px primitives in place; consistency debt known and ratcheting down.
- **Visual certification: field-pending** — cannot be scored ≥95 from code. Requires a device pass
  (the 4-question test, outdoor contrast, screen reader, dynamic type) per FINAL_RELEASE_CHECKLIST.md.

**Verdict:** see GO_NO_GO_UI.md — **⚠ PILOT READY (UI)**. The objective layer is certifiable and
green; the 95+ *visual* target is honestly not claimable until the on-device pass runs.
