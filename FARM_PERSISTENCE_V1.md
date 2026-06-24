# FARM_PERSISTENCE_V1

**Move farmer state from localStorage → PostgreSQL.** Sprint #227.
Closes the pre-mortem's #1 silent-data-loss risk (My Plants / history /
tasks were localStorage-only → gone on cache-clear / new device).

## Architecture: write-through mirror + authoritative recovery

PostgreSQL is now the **source of truth**; localStorage is demoted to a
**cache**. The pattern is non-invasive so it can't break the farmer flow:

```
  write (plant/scan/task/outcome/timeline)
        │
        ├─► localStorage  (cache — unchanged, instant, offline-safe)
        └─► farmSync.mirror(domain, id, payload)   ← NEW
                 │  best-effort, fire-and-forget, never throws
                 ├─ online  → debounced batch POST /api/farm-state/sync
                 └─ offline → localStorage queue → drains on reconnect

  login (user authenticated)
        └─► farmSync.recoverAll()                   ← NEW
                 GET /api/farm-state → hydrate each cache (server wins)
```

**Safety invariant:** every existing `localStorage.setItem` stays exactly
as it was. The new code only *adds* a mirror call + a login-time recover.
If sync fails entirely, the app behaves identically to before — this can
only add durability, never remove function.

## What's durable (all 5 domains)

| Domain | Mirror site | Hydrator | Status |
|---|---|---|---|
| **plants** (My Plants) | `managedPlantsStore` append/update/remove | `hydrateManagedPlants` | ✅ end-to-end |
| **scanHistory** | `scanHistoryStore.saveScanUseful` | `hydrateScanHistory` | ✅ end-to-end |
| **tasks** | `scanToTask.addScanTasks` | `hydrateScanTasks` | ✅ end-to-end |
| **outcomes** | `outcomeStore.recordOutcome` | `hydrateOutcomes` | ✅ end-to-end |
| **timeline** | `timelineStore.appendTimelineEntry` | `hydrateTimeline` | ✅ end-to-end |

Image bytes (thumbnails/dataURLs) are stripped before mirroring — the
server already holds the scan image; only metadata is synced (payload cap
100 KB/record).

## Server

- **`farm_state_records`** table — one row per `(user_id, domain,
  record_id)`, `UNIQUE` on that tuple (no duplicate rows). JSONB payload,
  `client_updated_at` for last-write-wins, soft `deleted` tombstones.
  Additive migration `20260624010000_farm_persistence` (prisma validate ✓).
- **`POST /api/farm-state/sync`** — batch upsert; an incoming record older
  than the stored one is skipped (a stale offline write can't clobber a
  newer value synced from another device).
- **`GET /api/farm-state?domains=…`** — recovery read (non-deleted).
- Both auth-only; `farmStateService` validates the domain + caps batch
  (300) and payload size; never throws to the response path.

## Diagnostics

`window.__farmSyncHealth()` →
`{ sourceOfTruth: 'postgres', localStorageRole: 'cache', online,
queueLength, domainsRegistered, lastSyncAt, lastRecoverAt, lastError }`.

## Requirements coverage

| Requirement | How |
|---|---|
| auto-save every scan | `saveScanUseful` mirrors `scanHistory` |
| auto-save every task | `addScanTasks` mirrors each `tasks` row |
| auto-save every plant | `appendManagedPlant`/update/remove mirror `plants` |
| auto-recover on login | `AuthContext` → `bootFarmPersistence` → `recoverAll` |
| offline queue sync on reconnect | `farroway_farm_sync_queue` drains on `online` + 60s tick |
| no localStorage as source of truth | server is authoritative; recover overwrites cache on login |

## Honest V1 boundaries (→ V2)

- **Recovery is on login + on reconnect drain**, not a live two-way
  subscription. Two devices editing the *same* record between logins
  resolve by `client_updated_at` (last-write-wins) — no field-level merge.
- **Reads still come from the localStorage cache** (hydrated from server
  on login). A mid-session pull-to-refresh that re-reconciles is V2.
- Existing typed server tables (`ScanTrainingEvent`, `TaskOutcome`, …)
  are unchanged; `farm_state_records` is the durability/recovery layer,
  not an analytics replacement.

These boundaries are deliberate: V1's job is to **end silent data loss**,
and it does — a farmer who clears data or switches phones gets their
plants, scans, tasks, outcomes, and timeline back on next login.
