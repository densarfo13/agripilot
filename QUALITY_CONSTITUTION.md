# Quality Constitution

Binding law for releases. Detailed how-to: QUALITY_MANUAL.md / QUALITY_BAR.md.

## Every release must improve at least one KPI
Scan Success · Recommendation Success · Crash-Free Sessions · Retention · Onboarding Completion ·
Task Completion.

A release that moves none of these is not a release — it's churn. (The charter's per-task rule:
work that improves no KPI is not built.)

## Binding rules
- **Quality Beats Speed** — a green `build:safe` (~398 gates) is the floor, not the ceiling.
- Every PR carries a KPI Impact line (which KPI, and the telemetry that proves it).
- A bug fix ships with a regression test + a gate so the failure mode can't return.

## Honest measurement state
The KPI *targets* and the gate floor are real and enforced. The KPI *numbers* (scan-success rate,
retention, crash-free %) require **live pilot telemetry that does not exist yet** — they are
measured starting at the internal-test/pilot run, not fabricated. Standing verdict:
**GO_FOR_INTERNAL_TEST** until those numbers exist (PRODUCTION_CERTIFICATION.md).
