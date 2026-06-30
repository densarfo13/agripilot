# UX Constitution

Binding law for every screen. Detailed how-to: DESIGN_BIBLE.md / UX_PRINCIPLES.md / SCREEN_STANDARDS.md.

## Every page
- One purpose
- One hero
- One primary CTA
- No duplicated information
- No backend language
- Maximum five major sections

## Enforced by
- One primary CTA → `check:ui-design-system`.
- No backend language → `check:home-no-internal-terms`, `check:copy-governor`, jargon gates.
- One token system / no inline styling → `check:design-system-v1`, `check:design-lint` (ratchet).
- Purpose declared → `check:screen-contract` (`src/design/screenContracts.js`).
- One hero / ≤5 sections → governed by SCREEN_STANDARDS.md + review (structural heuristic not yet
  reliably gate-able without false positives; documented in docs/design/DESIGN_LINTER.md).

## Binding rule
Calm beats dense. If a card does not help the farmer act, it does not belong above the fold.
