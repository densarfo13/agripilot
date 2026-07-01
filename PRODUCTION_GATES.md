# Production Gates

The release gate system is **real and enforced today**: `npm run build:safe` runs 400+ gates and
prints `[build:safe] PASS — N steps green.` A red gate fails the build. This is the "reject release
if…" mechanism the platform spec asks for — it already exists.

## Categories (representative, all in the build:safe chain)
- **Honesty (17 gates)** — `no-fake-intelligence`, `v13-no-fake-ml`, `honest-scan-engines`,
  `farmer-facing-ai-language`, `decision-no-jargon`, `farmbrain-ingestion-*`, `soilgrids-no-fake-
  data`, `ngo-no-fake-data`, `v8-voice-honesty`, … → **no fabricated diagnosis/price/metric/ML**.
- **Single brain** — `single-brain`, `farmbrain-x` → no duplicate recommendation logic.
- **Design system** — `design-lint` (inline-hex ratchet, debt can only fall), `design-primitives`
  (token-pure, no phantom tokens), `design-system-v1`, `screen-contract`, `ui-page-certification`
  (no engineering wording on any of 10 pages), `copy-governor`.
- **Localization** — language-consistency / parity / no-raw-keys across en/tw/fr/ha/sw (hi hidden).
- **Reliability / data integrity** — scan retry, provider-failure classification, persistence
  guard, prisma-migrations-clean, offline validation.
- **Pilot / launch** — `launch-command-center` (go/no-go ladder), scan-lifecycle-certification,
  pilot-readiness.

## Maps to the spec's "reject release if"
| Spec gate | Enforced by |
|---|---|
| duplicate logic / duplicate recommendations | `single-brain`, `farmbrain-x` |
| hardcoded colors / duplicate components | `design-lint`, `design-primitives` |
| translation regression | language-consistency + copy-governor |
| fabricated intelligence | 17 honesty gates |
| accessibility (structural) | 48px primitive + no-color-only + `ui-page-certification` |

## Honestly NOT yet gated (require runtime/device — see PILOT_READINESS.md)
Performance regression (no runtime capture), visual-regression (needs a rendered app), security
pen-test, live scan-accuracy. These are the field-pending blockers, not code gaps.
