# Accessibility Report

Status of the WCAG AA+ requirements. **Structural** items are verified in code/tokens; **experiential**
items require a real device and are honestly field-pending (FP) — not claimed from code.

## Verified in code
- **48px touch targets** — `CTAButton` enforces a 48px minimum height (> the 44px floor). Gate-adjacent.
- **Never color-alone** — `Badge` pairs every tone with a distinct dot glyph (●▲■•○); `ProgressRing`
  always pairs the ring with a visible label + an aria-label carrying the percentage and word.
- **AA/AAA contrast tokens** — `colors.js` documents measured ratios against the base navy #0B1A28:
  ink 15.4:1 (AAA), inkDim 11.1:1 (AAA), ochreInk 7.0:1 (AAA), greenInk 8.3:1 (AAA).
- **Contrast fix this sprint** — the primary `CTAButton` now uses dark ink on the gold surface
  (was light-gold-on-gold, a contrast defect); danger routes to the calibrated `error` token.
- **Real semantic elements** — `CTAButton` renders a real `<button>` (native keyboard + screen reader).
- **No engineering wording** — gate-locked across all 10 pages (`check:ui-page-certification`).

## Field-pending (needs a device)
- [ ] **VoiceOver / TalkBack** — full traversal order + labels on each of the 10 screens.
- [ ] **Dynamic type** — 200% text without clipping or overlap.
- [ ] **Keyboard support** — focus order + visible focus ring across flows.
- [ ] **Reduced motion** — `prefers-reduced-motion` honored (MOTION tokens are short; verify the
      media query is respected on device).
- [ ] **Safe areas** — notch / home-indicator insets on iPhone + Android.
- [ ] **Outdoor high-contrast** — legibility in direct sunlight.

## Verdict
Structural accessibility is **in place and partly gate-enforced**. The experiential half is the
on-device pass (FINAL_RELEASE_CHECKLIST.md). Honest status: **AA-structural PASS, device-experiential
pending.**
