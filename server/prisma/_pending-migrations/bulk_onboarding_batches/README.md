# bulk_onboarding_batches — pending migration fragment

Staged Prisma fragment for the bulk onboarding pipeline. It introduces ingest-side
bookkeeping tables (`EnrollmentBatch`, `EnrollmentBatchRow`) that drive CSV/XLSX
uploads, validation, dedupe, and supervised import of farmers into programs.

## Deploy order — admin_impact_demographics MUST land first

This fragment is **strictly downstream** of `admin_impact_demographics`. The
runtime referenced by these tables (`organizationId`, `programId`, matched/created
user ids that flow into `FarmerProfile` + `ProgramEnrollment`) targets models
defined in that canonical fragment.

Required deploy sequence:

1. `admin_impact_demographics/` — defines `Organization`, `Program`,
   `FarmerProfile`, `ProgramEnrollment`, and the supporting enums. These are
   the foreign-key targets the bulk onboarding runtime resolves against once
   live.
2. `bulk_onboarding_batches/` (this fragment) — adds `EnrollmentBatch` +
   `EnrollmentBatchRow` plus the `BatchStatus` and `BatchRowStatus` enums.

Deploying this fragment before `admin_impact_demographics` will leave the
onboarding runtime with no canonical user/profile/enrollment target to write
through to on commit.

## Conflict-free design — the conflict gate will pass

The `check:prisma-fragment-conflicts` gate verifies that no two pending
fragments define the same model or enum. This fragment is conflict-free by
construction:

- **No model overlap** with `admin_impact_demographics`,
  `enterprise_agriculture_platform`, `federated_identity`, or
  `plant_universal_runtime`. The two models introduced here
  (`EnrollmentBatch`, `EnrollmentBatchRow`) exist in no other fragment.
- **No enum overlap**. `BatchStatus` and `BatchRowStatus` are new names scoped
  to the batch ingest tables; they do not redeclare `OnboardingStatus`,
  `EnrollmentStatus`, `OrgStatus`, `ProgramStatus`, or any other enum from the
  canonical fragments.
- **No re-declaration of canonical models.** `FarmerProfile`,
  `ProgramEnrollment`, `Organization`, and `Program` are referenced by id only
  (string columns) rather than redefined. Compose with
  `admin_impact_demographics` at deploy time.

The fragments compose into a single Prisma schema without name collisions, so
the gate produces no diagnostics for this addition.

## Runtime fallback — in_memory until this fragment deploys

The bulk onboarding runtime under `src/runtime/organization/onboarding/*`
currently operates in an **in_memory** mode. Uploaded batches, parsed rows,
validation results, dedupe decisions, and supervised commits all live in
process-local stores; nothing is persisted across restarts. This is intentional
until the schema lands.

Once `admin_impact_demographics` and `bulk_onboarding_batches` have both been
deployed, the runtime flips from `in_memory` to the persisted Prisma-backed
mode and:

- writes each upload to `EnrollmentBatch` with the running counters
  (`totalRows`, `validRows`, `invalidRows`, `duplicateRows`, `importedRows`,
  `failedRows`) advancing as the pipeline progresses through `BatchStatus`;
- writes one `EnrollmentBatchRow` per parsed row, capturing `rawData`,
  `normalizedData`, `BatchRowStatus`, dedupe reasoning
  (`duplicateReason`, `matchedUserId`), and the resulting `createdUserId` on
  successful import into `FarmerProfile` + `ProgramEnrollment`.

Until both fragments are live, treat the in-memory implementation as the
source of truth and do not assume any batch state survives a deploy.
