# Data Governance

Every data element defines: owner · source · validation · freshness · retention · privacy ·
sync strategy · offline strategy · conflict resolution.

## Principles enforced today
- **Database is the source of truth; localStorage is cache.** Failed scans are review-only and
  never mutate FarmBrain / Digital Twin / tasks / plants (FarmBrain ingestion gates).
- **Honest "no live feed."** Yield / market / funding / buyer data is `no_live_feed` when no real
  provider exists — never fabricated (FarmBrainState canon).
- **Privacy:** secrets (API keys, auth headers) and image bytes are never logged or stored; only
  coarse coordinates (~1km) appear in diagnostics — verified by the scan-trace + location-debug
  redaction tests.
- **Idempotency / conflict resolution:** plants (idempotency key), timeline (60s window), tasks
  (same-day + server `Idempotency-Key`), recommendations (`uniq()`); the offline queue replays with
  the same key so a reconnect never double-writes.
- **Tenant isolation + audit:** enterprise data is tenant-scoped with audit logging
  (`check-enterprise-isolation`, `check-audit-logging`, `check-federation-security`).

## Field-pending
A formal per-field data dictionary (owner/freshness/retention table for every entity) is the next
documentation step; the *behaviors* above are gate-enforced today.
