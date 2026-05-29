# Plant Universal Runtime — Pending Migration

**Status:** READY · NOT YET DEPLOYED · supervised migration sprint required.

## What this directory contains

- `schema_fragment.prisma` — additive Plant + PlantTimelineEvent models + 3 enums (`PlantCategory`, `PlantSource`, `PlantTimelineEventType`).
- This README.

## Why it's not auto-applied

The standing migration safety guard (`scripts/ci/check-migration-safety.mjs`) requires every production-bound Prisma migration to be:
1. Reviewed against the existing schema for column drops / renames / type changes.
2. Tested in staging with a real backup-and-restore.
3. Reviewed for rollback path.
4. Deployed in a supervised window so the team can roll back if locks bite.

Runtime engines work fine without these tables today (plants persist via `localStorage` at the UI layer). The only thing waiting on this migration is **cross-device sync** — a separate feature, not a gap-fix concern.

## How to apply (supervised sprint)

```bash
# 1. Copy fragment into schema
cat server/prisma/migrations/_pending/plant_universal_runtime/schema_fragment.prisma \
  >> server/prisma/schema.prisma
# (then manually add @relation back-references on User, Farm, Garden)

# 2. Generate migration in staging
cd server && npx prisma migrate dev --name add_universal_plant_runtime

# 3. Review the generated SQL — additive only:
#    - CREATE TYPE PlantCategory
#    - CREATE TYPE PlantSource
#    - CREATE TYPE PlantTimelineEventType
#    - CREATE TABLE Plant
#    - CREATE TABLE PlantTimelineEvent
#    - CREATE INDEX (multiple)

# 4. Confirm rollback SQL is straightforward (DROP TABLE)

# 5. Apply to production via the existing convention
cd server && node scripts/prisma-deploy-with-baseline.mjs
```

## What lives in the schema fragment

### `Plant`
| Field | Type | Notes |
|---|---|---|
| `id` | String @id | cuid |
| `userId` | String | required |
| `farmId` | String? | optional — garden plants don't have one |
| `gardenId` | String? | optional |
| `commonName` | String | required |
| `scientificName` | String? | optional |
| `category` | enum `PlantCategory` | crop/flower/.../shrub/unknown |
| `subtype` | String? | family (Rosaceae, Solanaceae, ...) |
| `source` | enum `PlantSource` | manual \| scan |
| `healthScore` | Int | 0..100 |
| `riskScore` | Int | 0..100 |
| `lifecycleStage` | String | seed/sprout/vegetative/flowering/fruiting/harvest/dormant |
| `bloomStatus` | String? | not_ready/budding/blooming/post_bloom |
| `pollinatorScore` | Int? | 0..100 |
| `idempotencyKey` | String? @unique | `plant:create-from-scan:{scanId}:{farmIdOrGardenId}` |
| `createdAt` / `updatedAt` | DateTime | standard |

### `PlantTimelineEvent`
| Field | Type | Notes |
|---|---|---|
| `id` | String @id | cuid |
| `plantId` | String | FK to `Plant`, cascade delete |
| `eventType` | enum `PlantTimelineEventType` | 12 spec'd values |
| `title` | String | required |
| `description` | String? | optional |
| `metadata` | Json? | free-form payload |
| `photoUrl` | String? | scan photo if available |
| `scanId` | String? | optional FK to scan record |
| `taskId` | String? | optional FK to task record |
| `createdAt` | DateTime | standard |

## What does NOT change

- No existing model is touched (no column drops, no renames, no type changes)
- No existing index is removed
- No existing trigger / view / function is altered

## Strict-rule audit

- ✓ Additive only — fully reversible via `DROP TABLE`
- ✓ Aligns with `enum LifecycleStage` (already in schema)
- ✓ All FKs to existing models are optional → no backfill needed
- ✓ Idempotency key + cascade delete protect against the dedup / orphan scenarios the runtime spec calls out
