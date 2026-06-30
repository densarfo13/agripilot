# Farroway Design Bible

The permanent design language. Every future screen follows this — no exceptions. This document
is the umbrella; the specifics live in the linked standards. Everything here describes the
**real, shipped, gate-enforced** system (not aspiration).

## What Farroway is

A **Daily Farming Companion** — not a dashboard, not an ERP, not a reporting tool.

Every screen must:
- **Reduce thinking** — one purpose, one obvious next move.
- **Increase confidence** — honest, evidence-backed, calm.
- **Encourage action** — one primary action, always reachable.

## The seven principles

1. **One screen, one purpose.**
2. **One hero.**
3. **One primary action.**
4. **Maximum five supporting sections.**
5. **No duplicated information** (no repeated percentages / setup cards / timelines).
6. **No backend terminology** (no FarmBrain / provider / model / API / confidence-engine).
7. **Everything must feel calm.**

## The standards (this Bible's chapters)

| Chapter | File | Covers |
|---|---|---|
| Tokens | [DESIGN_TOKENS.md](DESIGN_TOKENS.md) | spacing · radius · elevation · motion · color · type — real values |
| Components | [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md) | 8 canonical cards · 5-variant button system · primitives |
| UX | [UX_PRINCIPLES.md](UX_PRINCIPLES.md) | the principles applied; reduce-think / increase-confidence / encourage-action |
| Screens | [SCREEN_STANDARDS.md](SCREEN_STANDARDS.md) | per-screen purpose + one-hero/one-CTA contract |
| Copy | [COPY_GUIDELINES.md](COPY_GUIDELINES.md) | Grade-6, farmer-first, no jargon, 6-locale localization |
| Accessibility | [ACCESSIBILITY_STANDARD.md](ACCESSIBILITY_STANDARD.md) | AA · 48px · VoiceOver · dynamic type · outdoor · reduced-motion |
| Architecture | [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md) · [DESIGN_SYSTEM_V1.md](DESIGN_SYSTEM_V1.md) | layer model + token/component catalog |

## How the Bible is enforced (not just written)

Rules that the build **fails on** today:

- **`check:design-system-v1`** — one frozen token index; primitives are token-driven; 48px floor.
- **`check:design-lint`** — ratchet: no screen may add inline colors; total inline-color debt
  (baseline 4276 across 227 pages) can only fall as screens migrate.
- **`check:ui-design-system`** — every grower surface declares one primary action; ≤3 accent colors.
- **`check:home-no-internal-terms` / `check:decision-no-jargon` / `check:farmer-facing-ai-language`**
  — no backend terminology reaches a farmer, in any locale.
- **`check:empty-state-guidance`** — empty states carry an explanation + a CTA (no dead ends).
- **`check:language-consistency` + parity ratchet** — no raw keys, no mixed-language core screens.

A rule that isn't enforced by a gate is a guideline, not a law. The laws above are wired into
`build:safe`.

## In doubt

Ask: **"Does this reduce a farmer's thinking and move them to one clear action?"** If not, cut it.
