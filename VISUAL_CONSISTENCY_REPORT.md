# Visual Consistency Report

Honest, measured state of UI consistency — backed by the design-lint ledger, not by eyeballing.

## What's enforced now (build-failing)

| Rule | Mechanism | Status |
|---|---|---|
| One token source of truth (9 categories, frozen) | `check:design-system-v1` + `designTokens.test.ts` | **PASS** |
| Canonical component barrel (one import path) | `check:design-system-v1` | **PASS** |
| New design-system primitives are token-driven (no hand-rolled scales) | `check:design-system-v1` | **PASS** |
| Buttons meet the 48px accessibility floor | `check:design-system-v1` (CTAButton) | **PASS** |
| **No screen may ADD inline colors** (ratchet) | `check:design-lint` | **PASS** |
| No backend jargon on Home / in locale values | `check:home-no-internal-terms` | **PASS** |

## The consistency ledger (the honest number)

Inline-hex-color debt across the app, captured at foundation completion:

- **Total: 4276 inline hex literals across 227 pages.**

This is the proxy for "screens not yet fully on the design system." The `check:design-lint`
ratchet **prevents this number from rising** and records the drop as each screen migrates onto
the tokens + barrel. `npm run design-lint:baseline` re-snapshots after a migration to lock the win.

## What is NOT yet consistent (honest)

- **The 4276 inline colors exist** — the 227 legacy pages still carry bespoke styling. The system
  + ratchet are in place; the *migration itself* (rewriting each screen onto the barrel) is the
  sequenced work. Today the ratchet guarantees consistency can only **improve**, never regress.
- **Per-screen visual quality** (spacing rhythm, one-hero, duplicate-card removal) is verified
  on **Home** (decision-first, readiness consolidated) but not on the other screens — that is a
  visual judgment that needs the rendered app, which the offline preview can't hydrate.

## How "production-ready visual consistency" is reached

1. Migrate a screen onto `src/design/components` (swap bespoke cards/buttons → barrel).
2. `check:design-lint` shows its inline-color debt drop; re-baseline to lock it.
3. Verify the rendered screen on production (the loop that already caught the Home contradiction bug).
4. Repeat for each of the 10 target screens; total debt monotonically → 0.

Consistency is now a **tracked, enforced, monotonically-improving metric** — not a one-time claim.
