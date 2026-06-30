# Quality Manual

The standard every release is held to, and how each item is checked.

| Quality dimension | How it's checked | Status |
|---|---|---|
| Tests pass | `build:safe` (lint/typecheck/test/build in-chain) | **auto** |
| Design consistency | design-system-v1 + design-lint ratchet | **auto (ratcheted)** |
| Copy / no jargon (6 locales) | copy-governor + jargon gates | **auto (ratcheted)** |
| Feature completeness | feature-manifest (12 fields) | **auto** |
| Screen discipline | screen-contract (purpose/question/CTA/success) | **auto** |
| Localization | language-consistency + parity ratchet | **auto** |
| Data integrity / AI honesty | FarmBrain + scan + sell gates | **auto** |
| Security / enterprise | enterprise-*, audit-logging, federation-security | **auto** |
| Design Score ≥95 (clarity/hierarchy/farmer-XP) | rubric (docs/design/UX_GOVERNOR.md) | **field-pending** (needs rendered app + reviewer) |
| Performance (first-paint <1s, 60fps, cold start <2s) | runtime measurement | **field-pending** |
| UX metrics (decision time, tap count, scroll depth, completion) | telemetry | **field-pending** |
| Accessibility (device VoiceOver/dynamic-type/reduced-motion) | device audit | **field-pending** |
| Visual regression | screenshot diff | **field-pending** |

## Why some items are field-pending (not faked)
A trustworthy score/metric for clarity, performance, and device accessibility needs a rendered app +
live telemetry the build can't produce. Per the honesty doctrine, Farroway does not emit fabricated
green numbers for these — they are measured during device/pilot testing. Everything marked **auto**
is a real build-failing gate today.
