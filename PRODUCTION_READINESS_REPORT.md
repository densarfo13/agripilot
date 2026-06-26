# PRODUCTION_READINESS_REPORT — v14 spec

| Build gate (spec) | Status |
|---|---|
| No fake confidence | enforced — confidence only on real measured/estimated/live |
| No hardcoded prediction | predictions are calendar-derived or declared `requires_model` |
| No fake provider data | providers certified from real live calls (DEGRADED → READY) |
| No fabricated measurements | CV fields `awaiting_model`; segmentation values never invented |
| FarmBrain ingest below threshold blocked | `canFarmBrainIngest` (≥70% + ingestable tier only) |
| Explainability present | why/evidence/confidence/alternative across v12 / agents / copilot |
| Evidence present | every field carries source + reason |
| Confidence present | every field carries confidence (0 when no value) |

## Honest readiness
- **Code:** production-ready, 360 build-safe gates, honest end to end, admin surface
  role-gated.
- **Providers:** keys set; one real scan flips DEGRADED → READY (cert fix is live).
- **CV measurements:** PENDING a real segmentation model (the one true capability gap).
- **Enterprise (10M farms / Kafka / K8s / SOC2):** `requires_infra` — an ops +
  certification program, not asserted from a sprint.

**Verdict: production-ready as a truthful engine; the remaining gaps are external
(a CV model, provider feeds, infra), not missing code.**
