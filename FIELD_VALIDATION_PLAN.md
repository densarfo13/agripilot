# FIELD_VALIDATION_PLAN — Phase 13

Field evidence cannot be produced from the build environment — this is the plan
for the operator to collect it (the verdict recomputes from these real numbers).

**Cohorts:** 10 → 50 → 100 farmers (staged).
**Collect (from `/admin/pilot-analytics`):** daily active users, weekly retention,
recommendation acceptance, task completion, crop improvements, farmer satisfaction.
**Per-scan (from the observability table):** plant accuracy, disease accuracy,
confidence, latency, recommendation usefulness.

**Promotion rule:** LIMITED PILOT → READY FOR 100 once the 10/50 cohorts show
healthy acceptance + completion + no safety regressions; → READY FOR 1000 after
the 100-cohort window. No tier is claimed without its cohort's real data.
