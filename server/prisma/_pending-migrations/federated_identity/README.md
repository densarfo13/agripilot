# Federated Identity — pending migration

Stages the 4 Prisma models for the Wave-15 enterprise federation
runtime: `FederationProvider`, `FederatedIdentity`,
`OrganizationLoginPolicy`, `ClaimRoleMapping`.

Active fragment. No collisions with the canonical
`admin_impact_demographics` fragment or with the committed
schema (no model-name overlap — verified by
`scripts/check-prisma-fragment-conflicts.mjs`).

## Deploy procedure

1. Merge this fragment into `server/prisma/schema.prisma`.
2. `cd server && npx prisma migrate dev --name federated_identity`
   on a local DB to generate the SQL.
3. Review `migration.sql`:
   - All 4 models created with the documented indexes.
   - `FederationProviderType` enum added.
   - No DROP on existing tables.
4. Move the generated migration directory to
   `server/prisma/migrations/<timestamp>_federated_identity/`.
5. Delete this `_pending-migrations/federated_identity/`
   directory in the SAME commit.
6. Provision the secrets store: each provider's
   `clientSecretRef` MUST resolve in the deployed env. The
   federation runtime never reads secrets directly; the API
   route stores only the reference.
7. Deploy to Railway.

## Runtime fallback while staged

The runtime modules at `src/runtime/auth/federation/` operate
on in-memory snapshots. `__federationHealth().persistence ===
'in_memory'` honestly surfaces this until the migration
deploys.

## Strict rules preserved

- Client secrets are stored as `clientSecretRef` only — never
  the literal secret. The CI gate
  `check:federation-security` enforces this.
- `ClaimRoleMapping.role` references the Farroway role string;
  `admin` / `organization_admin` are REJECTED by the API on
  write because the runtime's `NEVER_FROM_CLAIM_ROLES` set
  forbids them.
- All 4 models carry `organizationId` for tenant isolation —
  list queries fail closed without it.
