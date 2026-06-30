# Design Tokens — canonical values

The single source of truth is `src/design/tokens/` (one frozen index). These are the **real
exported values** — never hardcode an off-scale number, never invent a color. Enforced by
`check:design-system-v1` (token test, 24 assertions) + `check:design-lint` (no new inline colors).

## Spacing (`SPACING`)
`4 · 8 · 12 · 16 · 24 · 32 · 48` (px integers; `SPACING.css.*` for string literals).
*(Bible asks for a 4→48 scale; the shipped scale is the 7-step subset above — 20/40/64 are not
in use. Add only if a real layout needs them, then they enter the token file, never inline.)*

## Radius (`RADIUS`)
`sm 8 · md 12 · card 18 · lg 24 · xl 32 · pill 999`. Cards use **18** (`RADIUS.card`).

## Elevation (`ELEVATION`, z-index ladder)
`base 0 · raised 1 · sticky 10 · bottomNav 50 · header 60 · overlay 100 · sheet 110 · modal 120 · toast 200`.
Stacking order only; visual depth comes from `SHADOWS` (sm / card / modal / focus).

## Motion (`MOTION`)
Durations: `tap 140ms · fade 180ms · slide 220ms · shimmer 1400ms`. **Hard cap: < 250ms** for any
interaction transition. Easings: standard / decelerate (entrances) / accelerate (exits) / linear.
Pre-baked `MOTION.transitions.{tap,fade,slide}`.

## Color (`COLORS`)
A calm, premium palette on a deep navy base — **no neon, no flat grays** (ink is opacity-based).

| Role | Token | Value |
|---|---|---|
| Primary action (gold/ochre) | `ochrePrimary` | `#C8944D` (hover `#B9853F`) |
| Growth / success (olive) | `oliveLight` / `oliveSoft` | `#A8C283` / `#8FAB73` |
| Background base | `backgroundPrimary` / `backgroundSecondary` | `#08111A` / `#0B1A28` |
| Text primary | `textPrimary` / `ink` | `#EAF2FF` |
| Text dim / faint | `inkDim` / `inkFaint` | 72% / 50% opacity of ink |
| Semantic | success · warning · danger · info | olive · mustard · terracotta · blue |

Accent budget: **≤3 brand accents** (enforced by `check:ui-design-system`). Contrast verified
against the navy base — ink 15.4:1 (AAA), ochreInk 7.0:1, greenInk 8.3:1 (see ACCESSIBILITY_STANDARD.md).

## Typography (`TYPE`)
Roles: Display · Hero · Title · Subtitle · Body · Caption · Button (`TYPE.*`). Components read a
role — never a raw `fontSize`.

## Breakpoints + grid (`BREAKPOINTS`, `GRID`)
Mobile-first: `phone 0 · phoneLg 412 · tablet 768 · desktop 1024`. Content column `GRID.maxWidth`
= 32rem; gutter 16; card gap 12.

## The rule
> No screen implements its own spacing, radius, color, shadow, motion or type. It imports a token.
> New value needed? It goes in the token file first. The `check:design-lint` ratchet enforces this
> for colors today (debt can only fall); spacing/shadow follow the same model as screens migrate.
