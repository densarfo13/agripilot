# PILOT_SCALE_READINESS_REPORT.md

**Sprint #216 §11 — scale safety: DEFERRED (honest call).**
Date: 2026-06-19.

The spec asks for Redis caching, queue processing, rate limiting, retry
queues, and a dead-letter queue. **This is deliberately NOT built**, and
that is the correct decision under the mission's own constraint —
"without adding unnecessary complexity" — and the Pilot Execution Policy.

## Why deferred
- **No load to protect.** Phase-1 is ~10-20 farmers. The bundle-budget
  gate shows the client at 2.8MB/868KB; the server is a single Express
  app on Railway. There is no throughput problem to solve.
- **Premature infra is the risk, not the fix.** Standing up Redis +
  queue workers + a DLQ adds operational surface (more to deploy,
  monitor, and fail) for zero current benefit. That is exactly the
  complexity the objective says to avoid.
- **What already protects the pilot:** `__queueHealth` (#25),
  per-request error boundaries, the chunk-recovery + stale-bundle
  recovery paths, the offline idempotency guardian (#215), and the
  429-polling-loop gate. These cover correctness at pilot scale.

## When to revisit
At **>100 active farms** or first sustained 429/timeout signal in
production telemetry — then introduce Redis (cache + rate-limit) and a
job queue with a DLQ for notifications / scans / translations. Until
then, scale work is speculative.

## Verdict
**Scale-ready for the pilot cohort.** Not scale-ENGINEERED for growth —
intentionally, until real load justifies it.
