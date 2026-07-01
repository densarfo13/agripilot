# Responsive Report

Status of the responsive requirements across the target devices. The **system** (breakpoints,
fluid layout primitives) is verified in code; **per-device rendering** requires the actual devices
and is field-pending (FP).

## Verified in code
- **Breakpoint tokens** — `src/design/tokens/breakpoints.js` defines the canonical BREAKPOINTS +
  GRID (single source; no ad-hoc media-query widths in the design system).
- **Fluid primitives** — `CTAButton` defaults to `fullWidth` (100%); spacing/radius come from
  tokens, so layout scales with the token scale rather than fixed pixels.
- **Mobile-first shell** — the app is a mobile-first PWA; the premium mobile shell is the primary
  target.

## Field-pending (needs the actual devices)
| Device | Status | What to verify |
|---|---|---|
| iPhone SE (small) | FP | no clipping at 375px; hero + one CTA above the fold |
| iPhone 16 | FP | safe-area insets; hero scale |
| Android small | FP | 360px width; tap targets in the hand |
| Android large | FP | large-screen spacing not stretched |
| Tablet | FP | content max-width, not full-bleed line lengths |
| Desktop Web | FP | centered column, no full-width text runs |

## Verdict
The responsive **foundation** (breakpoint tokens + fluid, token-driven primitives) is in place.
Per-device correctness is the on-device pass — it cannot be certified from code in this environment.
Honest status: **system PASS, per-device pending.**
