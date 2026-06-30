# Farroway Product Operating System

Farroway is a Product OS, not just an app: features, screens, copy, AI, data and releases follow the
standards **automatically** because the build enforces them. Developers don't rely on memory.

## The product question
Every product decision must answer: **"Does this help the farmer make today's next best decision?"**
If no → reject.

## Pillars
Simple · Trustworthy · Actionable · Localized · Offline-first · Fast · Accessible · Evidence-based ·
Human-centered · Scalable.

## The Product OS is enforced (build-failing gates)

| Governor | What it enforces | Gate |
|---|---|---|
| **Feature** | every feature declares 12 fields (problem→enterpriseImpact) | `check:feature-manifest` (+ `src/product/featureManifest.js`) |
| **Screen** | every core screen declares purpose/question/CTA/success | `check:screen-contract` |
| **Design** | one token source; no new inline colors (ratchet); one primary action | `check:design-system-v1`, `check:design-lint`, `check:ui-design-system` |
| **Copy** | plain language; no jargon; no internal wording in any locale | `check:copy-governor` + 4 jargon gates |
| **AI honesty** | never fabricate diagnosis/confidence/price; evidence + fallback | scan/decision/sell gates (see AI_GOVERNANCE.md) |
| **Localization** | no raw keys, no mixed language, 6-locale parity | `check:language-consistency` + parity ratchet |
| **Data integrity** | failed scan never corrupts farm state; honest no_live_feed | FarmBrain + sell-decision gates |
| **Enterprise** | tenant isolation, audit logging, federation security | `check:enterprise-*`, `check:audit-logging`, `check:federation-security` |
| **Release** | the full chain green before merge | `check:release-governor`, `build:safe` (~398 gates) |

## The Product OS is documented (this constitution)
[ENGINEERING_PLAYBOOK.md](ENGINEERING_PLAYBOOK.md) · [PRODUCT_PLAYBOOK.md](PRODUCT_PLAYBOOK.md) ·
[AI_GOVERNANCE.md](AI_GOVERNANCE.md) · [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) ·
[FEATURE_LIFECYCLE.md](FEATURE_LIFECYCLE.md) · [RELEASE_STANDARD.md](RELEASE_STANDARD.md) ·
[QUALITY_MANUAL.md](QUALITY_MANUAL.md). Builds on the existing constitution:
docs/company/COMPANY_ENGINEERING_CHARTER.md, DESIGN_BIBLE.md, docs/design/DESIGN_GOVERNANCE.md,
PRODUCTION_CERTIFICATION.md.

## What is NOT auto-enforced (honest — same as the design + production certs)
Runtime/visual governance — **Design Score ≥95, performance (first-paint <1s / 60fps), UX metrics
(decision time, tap count, scroll depth), observability dashboards, app-wide device accessibility** —
require a rendered app + live telemetry the build cannot produce. These are documented as rubrics
+ measured during device/pilot testing (QUALITY_MANUAL.md), never faked as green gates. Standing
verdict: **GO_FOR_INTERNAL_TEST** until real pilot metrics exist.
