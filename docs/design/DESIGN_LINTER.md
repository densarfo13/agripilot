# Design Linter

Automated UI validation that rejects non-conforming code at build time. Each rule is a real gate in
`build:safe`; "ratchet" gates allow only improvement (debt can never rise).

| Reject when… | Gate | Status |
|---|---|---|
| A new color outside the design tokens | `check:design-lint` (ratchet) | **live** |
| More than one primary CTA / no primary action | `check:ui-design-system` | **live** |
| Backend wording visible to a farmer | `check:copy-governor` + 4 jargon gates | **live** |
| Missing translation keys / raw keys / mixed language | `check:language-consistency` + parity ratchet | **live** |
| Hardcoded farmer-facing strings | `check:hardcoded-grower-copy`, `audit:i18n` | **live** |
| Empty / dead-end screen (no CTA) | `check:empty-state-guidance` | **live** |
| A primitive hardcodes a scale instead of a token | `check:design-system-v1` | **live** |
| Missing screen contract (purpose/question/CTA/success) | `check:screen-contract` | **live** |
| More than 1 hero / more than 5 major sections | — | **rubric** (structural heuristic not yet reliable to gate without false positives; governed by SCREEN_STANDARDS.md + review) |
| New typography / spacing / radius / shadow scale | — | **partial** (colors ratcheted live; type/spacing/shadow follow the same ratchet model as screens migrate) |

## Developer experience
A PR that adds `color: '#ff0000'` to a screen → `check:design-lint` fails with the file + the rise.
Fix: use a token from `src/design/tokens`. Migrate a screen to tokens → its debt drops →
`npm run design-lint:baseline` locks the win.

## Extending the linter
New laws are `scripts/check-*.mjs` gates wired into `build:safe:steps`. Prefer the **ratchet**
pattern (baseline + only-decrease) for anything with legacy debt, so the law turns on immediately
without a flag-day rewrite.
