# Pending Migration Reconciliation

Authoritative document for the supervised-deploy decision making
across all `_pending-migrations/` fragments.

## Active fragments

### `admin_impact_demographics/` — canonical
Status: **ACTIVE — deploy next**.

Stages: `FarmerProfile`, `Organization`, `Program`,
`ProgramEnrollment`, `Intervention`, `InterventionParticipant`,
`ImpactRecord`, `ReportRecord` + 13 enums (incl. `AgeRange`,
`Gender` with `prefer_not_to_say`).

This fragment is the canonical shape for the Wave-13 admin
impact + demographics record system AND the Wave-14 buyer/NGO
portal layer. It is the SINGLE source of truth for organization
/ program / intervention models going forward.

### `plant_universal_runtime/` — independent
Status: **ACTIVE — independent**.

Stages plant runtime tables. No collisions with the admin
impact fragment; both can deploy in either order.

## Superseded fragments

### `enterprise_agriculture_platform/` — superseded
Status: **SUPERSEDED**. Marked with `SUPERSEDED.md` and excluded
from the conflict detector.

Why superseded: this older fragment staged competing shapes for
`Organization`, `Program`, `Intervention`, `InterventionParticipant`
+ overlapping enums (`OrgType`, `OrgStatus`, `ProgramStatus`,
`InterventionType`, `InterventionStatus`, `ParticipantStatus`).
The `admin_impact_demographics` fragment has the newer canonical
shapes used by both Wave-13 (admin impact) and Wave-14
(buyer/NGO portals) runtime layers.

Audit-only retention: kept in the repo so the design lineage is
visible. NOT deployable as-is.

### Fields ported / dropped during reconciliation

The older fragment introduced these models that the canonical
fragment does NOT carry:

- `ProgramFarmer` — superseded by `ProgramEnrollment` in
  the canonical fragment (`ProgramEnrollment` carries the same
  semantics: programId + userId + status + farmId).
- `ImpactReport` — superseded by `ReportRecord` (canonical
  fragment uses a stricter type-driven shape that includes the
  `fakeData: false` honesty contract).
- `TrustScore` — DEFERRED. The Wave-12 EnterpriseTrustEngine
  exists at `src/runtime/enterprise/EnterpriseTrustEngine.ts`
  but the persisted model is not staged. When trust persistence
  is needed, add a `farroway_trust_scores` table via a NEW
  fragment under `_pending-migrations/trust_persistence/`.

### `OrganizationMember`
The older fragment carried `OrganizationMember`. The canonical
fragment did NOT yet stage it (the field-officer / ngo_admin
role data lives in the runtime layer). The runtime
`src/runtime/organization/OrganizationRuntime.ts` already wires
membership in memory.

Action item before supervised deploy: ADD `OrganizationMember`
to `admin_impact_demographics/schema_fragment.prisma` so the
membership data persists when the canonical fragment lands.
Shape from the superseded fragment:

```prisma
model OrganizationMember {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  role           String   // 'ngo_admin' | 'field_officer' | 'organization_viewer'
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([organizationId, userId])
  @@index([organizationId])
}
```

## Committed schema collisions (documented, expected)

The canonical fragment's `Organization`, `Program`, `Cohort`,
`Intervention` model names ALREADY exist as bare legacy versions
in `server/prisma/schema.prisma` (rows 21, 44, 66, 2069). These
collisions are EXPECTED and resolved during the supervised
deploy by:

1. Reviewing the canonical fragment's column set vs the
   committed model's column set.
2. Emitting a `migration.sql` that:
   - ADDs new columns the canonical fragment introduces.
   - PRESERVEs existing data (no DROP without explicit approval).
   - Adds the new indexes from the canonical fragment.
3. The `prisma migrate dev --name admin_impact_demographics`
   step inside the supervised deploy procedure generates this
   SQL; review BEFORE moving it to `prisma/migrations/`.

The legacy `OnboardingStatus` enum committed in `schema.prisma`
already has a subset of the canonical fragment's values; the
migration ALTER TYPE adds the missing variants.

## Supervised deploy order

1. Merge `admin_impact_demographics/schema_fragment.prisma` into
   `server/prisma/schema.prisma` (add `OrganizationMember` per
   the action item above).
2. `cd server && npx prisma migrate dev --name admin_impact_demographics`.
3. Review `migration.sql` for no data-loss on committed models.
4. Move generated migration directory to
   `server/prisma/migrations/<timestamp>_admin_impact_demographics/`.
5. Delete `_pending-migrations/admin_impact_demographics/` in
   the SAME commit.
6. Deploy to Railway.
7. Once stable, archive `_pending-migrations/enterprise_agriculture_platform/`
   under `_pending-migrations/_archive/` (the CI gate already
   skips it via the `SUPERSEDED.md` marker; archiving is
   optional cleanup).

`plant_universal_runtime/` can deploy independently before or
after the admin impact migration.
