# Farroway Design Governance

Farroway is **self-governing**: the Design Bible standards are enforced by the build, not by memory.
Break a rule → failing build, not a review comment someone might miss.

This file indexes the enforcement. The Bible chapters live at repo root (DESIGN_BIBLE.md,
DESIGN_TOKENS.md, COMPONENT_LIBRARY.md, COPY_GUIDELINES.md, ACCESSIBILITY_STANDARD.md,
UX_PRINCIPLES.md, SCREEN_STANDARDS.md). The *enforcement* lives here.

## Enforced automatically (build-failing, in `npm run build:safe`)

| Rule | Governor (gate) | Mechanism |
|---|---|---|
| One token source; primitives token-driven; 48px floor | `check:design-system-v1` | static + token test |
| No NEW inline colors (every screen → tokens) | `check:design-lint` | ratchet over 227 pages (debt only falls) |
| One primary action per surface; ≤3 accents | `check:ui-design-system` | static |
| No internal wording in farmer copy (any locale) | `check:copy-governor` | ratchet over 6 locale value-sets |
| No backend terms on Home / decisions / scan | `check:home-no-internal-terms`, `check:decision-no-jargon`, `check:farmer-facing-ai-language`, `check:scan-farmer-safe-language` | static |
| Every core screen declares purpose/question/CTA/success | `check:screen-contract` | registry (`src/design/screenContracts.js`) |
| No raw keys / mixed-language core screens | `check:language-consistency` + parity ratchet | static + ratchet |
| Empty states carry explanation + CTA (no dead ends) | `check:empty-state-guidance` | static |
| Bottom nav respects safe areas | `check:mobile-safe-layout` | static |

## NOT auto-enforced (and why — honesty)

These need a rendered app + device, which the build cannot do:

- **Design Score / clarity / hierarchy** — subjective + visual; rubric in UX_GOVERNOR.md.
  Not auto-scored (a fabricated 95 would be dishonest).
- **Performance (first-paint, 60fps) / UX metrics (tap count, scroll depth)** — runtime
  instrumentation; field-pending. See PRODUCTION_READINESS.md.
- **App-wide VoiceOver / dynamic-type / visual-regression** — device tests; field-pending.

Documented as standards + verified during device/pilot testing — not faked as green gates.

See: DESIGN_LINTER.md · QUALITY_GATE_SYSTEM.md · UX_GOVERNOR.md · PRODUCTION_READINESS.md.
