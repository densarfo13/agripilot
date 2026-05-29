# Admin Impact + Demographics + Record System — pending migration

This directory stages the Prisma schema fragment for the
**Admin Impact** sprint (Wave 13). It lives at
`server/prisma/_pending-migrations/` — **NOT** inside
`server/prisma/migrations/` — because production
`prisma migrate deploy` walks the migrations directory and
would crash on the missing `migration.sql`. The May-2026
production-502 incident taught this rule; do not relocate
without supervised deploy.

## Models staged

- `FarmerProfile` — onboarding + optional demographics
  (age, gender) with `prefer_not_to_say` in every enum.
  Consent flag for program reporting.
- `Organization` — NGO / Government / Cooperative /
  Agribusiness / Internal.
- `Program` — organization-scoped.
- `ProgramEnrollment` — farmer ↔ program join.
- `Intervention` — training / seed / fertilizer / irrigation /
  pest_control / finance / advisory / other.
- `InterventionParticipant` — farmer ↔ intervention join with
  evidence photo + completion timestamp.
- `ImpactRecord` — the canonical impact ledger across 8
  event types (scan_completed → buyer_interest_received).
- `ReportRecord` — generated reports (founder_summary /
  organization_summary / program_impact /
  intervention_summary). `fakeData: false` declared in
  runtime; reports surface "Not enough data yet" when inputs
  are empty.

## Deploy procedure

1. Copy `schema_fragment.prisma` block contents into
   `server/prisma/schema.prisma` (merge with the existing
   schema; preserve generator + datasource lines).
2. `cd server && npx prisma migrate dev --name admin_impact_demographics`
   on a local DB to generate the SQL.
3. Review the generated `migration.sql` for:
   - No data-loss DROP/RENAME on existing models.
   - All new enums declared.
   - All new indexes present.
4. Commit the new directory under
   `server/prisma/migrations/<timestamp>_admin_impact_demographics/`.
5. **Delete this `_pending-migrations/admin_impact_demographics/`
   directory in the same commit.**
6. Deploy to Railway. `prisma migrate deploy` runs the new
   migration once.

## Runtime fallback while staged

Until the migration deploys, the runtime modules at
`src/runtime/admin/` hold records in-memory and emit
`fakeData: false` snapshots. Server API writes (if/when
exposed) should return 503 with
`reason: 'admin_impact_persistence_pending_migration'`.

## Strict rules preserved

- Demographics are NEVER required — every enum includes
  `prefer_not_to_say`. The Prisma fields are nullable.
- No PII (phone / email / fullName) added by this sprint.
- Reports / impact ledger fakeData: false at the contract
  level.
- Wave-5 single-writer invariant — engines never write to
  durable storage directly; the server-side API + journal
  store own that.
