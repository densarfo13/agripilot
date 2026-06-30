# UX Principles

Farroway is a **Daily Farming Companion**. Three jobs on every screen:

1. **Reduce thinking** — the screen answers one question; the next move is obvious.
2. **Increase confidence** — honest, evidence-backed, calm. "I don't know" beats a confident wrong answer.
3. **Encourage action** — one primary action, always reachable, never a dead end.

## The seven laws (from the Design Bible)

1. One screen, one purpose.
2. One hero.
3. One primary action.
4. ≤ 5 supporting sections.
5. No duplicated information.
6. No backend terminology.
7. Everything feels calm.

## Applied

- **Hero first.** The hero answers the screen's question (see SCREEN_STANDARDS.md). Everything
  else supports it and sits below.
- **One CTA.** Exactly one primary action (`CTAButton variant="primary"` / `data-primary-action`).
  Secondary actions are `secondary`/`ghost`/`text`. Enforced by `check:ui-design-system`.
- **No duplication.** Never two percentages for the same thing, two setup cards, or two timelines.
  (This was a real bug — three readiness cards on Home — now consolidated into one Farm Readiness card.)
- **Honesty.** No fabricated diagnosis / confidence / price / metric. Weak evidence → show the setup
  step that unlocks value, not invented advice.
- **Calm.** Motion < 250ms, subtle. No flashy effects. Whitespace over density.

## Decision test
> "Does this reduce a farmer's thinking and move them toward one clear action?"
> If no → it doesn't belong on the screen.
