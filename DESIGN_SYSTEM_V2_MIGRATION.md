# Design System — Migration Status (measured)

This is the honest, **measured** state — not a claimed 100%. The design-system *foundation* is
complete and gate-enforced; broad *screen migration* is early. I will not certify "100% migrated"
because it is not true and cannot be verified from code.

## Foundation — COMPLETE (and gate-enforced)
- **Tokens (single source):** `src/design/tokens/` — colors, spacing, typography, radius, shadows,
  motion, breakpoints, elevation + `index.js`. `COLORS` is the one palette (47 keys).
- **Canonical components:** `src/design/components/` — CTAButton, ProgressRing, Badge (new, fully
  token-driven), plus the barrel aliasing the existing premium library to canonical names
  (HeroCard→PremiumPageHero, SectionCard→PremiumCard, EmptyState, KPIChip, SectionTitle,
  SkeletonLoader). **Build Once — no duplicate card/hero/empty-state was created.**
- **Enforcement (6 gates in build:safe):** `check:design-lint` (inline-hex ratchet — debt can only
  fall), `check:design-primitives` (primitives are token-pure, no phantom tokens), `check:design-
  system-v1`, `check:screen-contract`, `check:ui-page-certification` (no engineering wording),
  `check:copy-governor`.

## Migration — EARLY (measured, not claimed)
| Metric | Value |
|---|---|
| Page files in `src/pages` | ~207 (incl. many internal/admin/diagnostic pages) |
| Pages importing the design system / tokens / premium directly | **14** |
| Inline-hex debt (ratchet baseline) | **4,276** across 227 tracked files; worst file 159 |

**Design-consistency score (honest): foundation ~100%, screen adoption low.** Most screens still
carry hand-rolled UI + inline hex. That is the real backlog.

## Why this is not "100% migrated" today
1. **Per-screen migration needs visual verification.** Swapping a screen's cards/spacing/colors to
   the system changes rendered output; it must be checked on a real rendered app + device. This
   environment cannot render the authenticated app, so a blind mass-migration would risk breaking
   layouts — the opposite of a safe production migration.
2. **4,276 inline-hex values** must be mapped to tokens screen-by-screen and visually confirmed.
3. The ratchet already **prevents new debt** (any new page must be token-driven; existing debt can
   only fall) — so the system trends toward full adoption safely, one verified screen at a time.

## The honest path to 100%
- Migrate screens in priority order (Home ✓ decision-first; then My Farm, Tasks, Scan, Sell …),
  each: replace ad-hoc cards with `SectionCard`/`HeroCard`, hex→tokens, then **verify on device**,
  then tighten the ratchet (`check-design-lint.mjs --update`). The debt number is the scoreboard.
- This is real work that requires a rendered app + device pass — **not another spec.**

**Verdict:** Design System **foundation PRODUCTION-READY and enforced**; **screen migration IN
PROGRESS** (measured 14 pages adopted, 4,276 hex debt). Converges with the standing ⚠ PILOT READY.
