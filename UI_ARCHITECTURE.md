# Farroway UI Architecture

How the interface is structured so every screen inherits from one system — and how that
inheritance is *enforced* over time rather than asserted once.

## Layers

```
src/design/tokens/        ← single source of truth (frozen constants)
   colors · spacing · typography · radius · shadows · motion
   breakpoints (+ grid) · elevation (z-index)
        ▲ imported by
src/design/components/     ← canonical component barrel (one import path)
   CTAButton · ProgressRing · Badge        (new, token-driven primitives)
   HeroCard · SectionCard · EmptyState · KPIChip · SectionTitle · SkeletonLoader
        (aliases over the existing premium/ library — Build Once, no duplication)
        ▲ consumed by
src/pages/*.jsx            ← screens (migrating onto the barrel, screen by screen)
```

A screen should import **only** from `src/design/components` and `src/design/tokens` — never
hand-roll a card, button, color, or spacing value.

## Enforcement (this is the architectural part)

Two gates in `build:safe` keep the system honest:

1. **`check:design-system-v1`** — locks the foundation: one token index (9 categories, frozen),
   the canonical barrel, the new primitives are token-driven, and CTAButton holds the 48px
   accessibility floor. The token contract test (`designTokens.test.ts`, 24 assertions) runs here.

2. **`check:design-lint`** — the migration **ratchet**. It records each page's inline-hex-color
   count in `scripts/design-debt-baseline.json` and **fails the build if any page's count rises**.
   Debt can only hold or fall. Migrating a screen to tokens lowers its number;
   `npm run design-lint:baseline` then re-snapshots so the win is locked in.

The ratchet is why this is a *system*, not a paint job: new inline colors are rejected at build
time, and the total debt is a single number that can only go down as screens migrate.

## Migration model

- **Foundation: done + gated.**
- **Screens: migrate one at a time.** Each migration swaps a screen's bespoke cards/buttons for
  the barrel, drops its inline-hex count, and re-baselines. Coverage tightens monotonically.
- Components not yet built (StatusCard, ProgressCard, ActionCard, TimelineCard, FarmCard,
  WeatherCard, BottomSheet, ConfirmationDialog, Toast, …) are added **when a migrating screen
  consumes them** — no speculative, unused components (Build Once).

## Current state

Baseline at foundation completion: **227 pages, 4276 inline-hex literals.** That is the number the
ratchet drives toward zero, screen by screen. See VISUAL_CONSISTENCY_REPORT.md for the ledger.
