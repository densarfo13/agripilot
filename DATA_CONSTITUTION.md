# Data Constitution

Binding law for every data field. Detailed how-to: DATA_GOVERNANCE.md.

## Every data field defines
Owner · Source · Freshness · Validation · Offline behavior · Conflict strategy · Retention · Privacy.

## Binding rules (enforced today)
- **Database is the source of truth; localStorage is cache.**
- **No fabrication** — yield/market/funding/buyer data is honestly `no_live_feed` when no real
  provider exists (FarmBrainState canon).
- **Failed input never corrupts state** — a failed scan is review-only; never mutates FarmBrain /
  Twin / tasks / plants (FarmBrain ingestion gates).
- **Privacy** — secrets + image bytes never logged/stored; coarse coords only (~1km) in diagnostics
  (scan-trace + location-debug redaction tests).
- **Conflict / idempotency** — plants (idempotency key), timeline (60s window), tasks (server
  `Idempotency-Key`), recommendations (`uniq()`); offline queue replays exactly once.

## Field-pending
A formal per-entity data dictionary (owner/freshness/retention table) is the next doc step; the
behaviors above are gate-enforced now.
