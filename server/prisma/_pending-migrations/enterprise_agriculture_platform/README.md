# Enterprise Agriculture Platform — Pending Migration

**Status:** READY · NOT YET DEPLOYED · supervised migration sprint required.

**Location:** `server/prisma/_pending-migrations/enterprise_agriculture_platform/`
(OUTSIDE `prisma/migrations/` so Prisma's startup `migrate deploy`
does not pick it up — same convention as `plant_universal_runtime/`).

## What this directory contains

- `schema_fragment.prisma` — 9 tables + 10 enums for the Enterprise Agriculture Platform.
- This README.

## Why not auto-applied

Two Prisma migrations awaiting supervised DBA window now stage here:
1. `plant_universal_runtime/` — Plant + PlantTimelineEvent
2. `enterprise_agriculture_platform/` — this one

Both will deploy together when the team has a supervised window with:
- Staging backup-and-restore test
- Documented rollback path
- Monitoring window for lock behaviour

## What the runtime + routes do today (without the tables)

- **Runtime engines** are pure compute over caller-injected data; they work fine without DB tables. The route layer either:
  - Pulls real aggregates from existing tables (User / Farm / Garden / Scan / Task) + localStorage `farroway_managed_plants` for plants → returns aggregated `/analytics/*` envelopes
  - Returns `503 enterprise_persistence_pending_migration` for write endpoints (`POST /organizations`, `POST /programs`, etc.)
- **UI pages** show aggregates when data exists; otherwise "Not enough data yet" empty states.

## Tables in this migration

| Table | Purpose | Key columns |
|---|---|---|
| `Organization` | NGO / Government / Cooperative / etc. | name · type · country · status |
| `OrganizationMember` | role-based access | userId · role (6 roles) |
| `Program` | a campaign / initiative within an org | cropFocus · region · startDate · endDate |
| `ProgramFarmer` | farmer enrolment in a program | status (invited/active/inactive/completed) |
| `Cohort` | grouping (region / crop / training / etc.) | type (6 kinds) |
| `Intervention` | seed / training / pest_control / etc. | type (8 kinds) · idempotencyKey @unique |
| `InterventionParticipant` | assignment + outcome | status (5 kinds) · idempotencyKey @unique |
| `ImpactReport` | flat metrics envelope | metrics Json · status (draft/generated/exported) |
| `TrustScore` | farmer / farm / program trust signals | type · score · factors Json |

10 enums total. All FKs to existing User / Farm / Garden / Plant tables are **optional** so no backfill is required.

## How to apply (supervised sprint)

```bash
# 1. Copy fragment into schema
cat server/prisma/_pending-migrations/enterprise_agriculture_platform/schema_fragment.prisma \
  >> server/prisma/schema.prisma
# (then manually uncomment @relation back-references on User, Farm, Garden, Plant)

# 2. Generate migration in staging
cd server && npx prisma migrate dev --name add_enterprise_agriculture_platform

# 3. Review the generated SQL — additive only:
#    - CREATE TYPE OrgType, ProgramStatus, ... (10 enums)
#    - CREATE TABLE Organization, OrganizationMember, ... (9 tables)
#    - CREATE INDEX (multiple)
#    - CREATE UNIQUE INDEX on idempotencyKey columns

# 4. Confirm rollback SQL is straightforward (DROP TABLE in reverse order)

# 5. Apply to production via the existing convention
cd server && node scripts/prisma-deploy-with-baseline.mjs
```

## Strict-rule audit

- ✓ Additive only — fully reversible via `DROP TABLE` (reverse order respects FKs)
- ✓ All FKs to existing models are optional → no backfill needed
- ✓ Idempotency keys on Intervention + InterventionParticipant prevent duplicates on retry/reconnect
- ✓ Cascade delete on Organization → Members/Programs/Cohorts/Interventions/Reports so an org tear-down doesn't leave orphans
