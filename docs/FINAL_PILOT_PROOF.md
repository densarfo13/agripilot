# Farroway Final Pilot Proof Production Fix

Proves Farroway is pilot-ready with REAL end-to-end workflows. Ten read-only
proof runtimes attest each critical flow, a composite folds them into one
verdict, two dashboards surface them, and six hard gates forbid any fake green.

> Decision support, not a guarantee. No fake metrics, no fake persistence, no
> fake invite delivery, no fake outcomes, no fake translation completion.

---

## 1. Files created
Proof runtimes — `src/runtime/proof/` (self-contained, frozen, never throw):
- `DailyPlanProofRuntime.ts` → `__dailyPlanProofHealth`
- `ScanToTaskProofRuntime.ts` → `__scanToTaskProofHealth`
- `PostHarvestProofRuntime.ts` → `__postHarvestProofHealth`
- `OutcomeProofRuntime.ts` → `__outcomeProofHealth`
- `DataReadinessRuntime.ts` → `__dataReadinessHealth`
- `TranslationReviewProofRuntime.ts` → `__translationReviewHealth`
- `PersistenceProofRuntime.ts` → `__persistenceProofHealth`
- `InviteProofRuntime.ts` → `__inviteProofHealth`
- `OfflineSyncProofRuntime.ts` → `__offlineSyncProofHealth`
- `OnboardingProofRuntime.ts` → `__onboardingProofHealth`
- `FinalPilotProofRuntime.ts` → `__finalPilotProofHealth` + `__recordProofRun`

UI + scripts:
- `src/pages/internal/OfflineQAPage.jsx` (route `/internal/qa/offline`)
- `scripts/validate-persistence-proof.mjs` (`npm run validate:persistence:proof`)
- 6 gates: `scripts/check-{final-pilot-proof,proof-no-fake-pass,persistence-proof,invite-proof,outcome-proof,onboarding-proof}.mjs`
- `docs/FINAL_PILOT_PROOF.md`

## 2. Files modified
- `src/App.jsx` — boot installs for the 11 proof globals (composite last) + the `/internal/qa/offline` route.
- `src/pages/internal/PilotReadinessPage.jsx` — Final Pilot Proof board (10 statuses + verdict + score; no fake green).
- `src/pages/internal/I18nQAPage.jsx` — translation review proof panel (Twi/Hausa/Swahili/Hindi review status).
- `package.json` — `validate:persistence:proof` + 6 gates wired into `build:safe`.

## 3. The honesty contract (enforced by the gates)
Every proof returns `{ ...fields, validationSource, proofStatus, confidence, explanation, limitations }`:
- **PASS** only when `validationSource` is a non-empty string — real evidence
  from the canonical event log (`farroway.farmEvents` / `farroway_event_log`),
  a real store, an honest probe attestation, or a **recorded proof run**.
- **FAIL** when a wired capability probe explicitly reports broken.
- **NEEDS_TEST** when wired but not yet exercised by a real workflow.
- Never PASS from configuration alone.

`window.__recordProofRun(name, source, note)` is the ONLY way a human turns a
NEEDS_TEST manual proof (invite delivery, offline sync, persistence write/read)
into PASS — it records, with a **required source + timestamp**, that a real
test was run. No source → no record.

## 4–12. Per-proof summary
- **Daily plan**: home plan visible + mark-done ready (probes) + a real
  `task_completed` event → PASS; else NEEDS_TEST; FAIL if planReady=false.
- **Scan-to-task**: upload/analysis/result ready + a real scan in history →
  PASS; FAIL if upload analysis broken.
- **Post-harvest**: checklist + storage guidance (probe) + a real
  harvest event → PASS.
- **Outcome**: PASS REQUIRES a completed follow-up scan + recorded outcome
  (improved/unchanged/worsened/unknown).
- **Data readiness**: real counts only (`demoExcluded:true`); NEEDS_DATA →
  PILOT_READY (≥10 scans, ≥5 tasks) → PROGRAM_READY (≥5 outcomes, ≥3 follow-ups).
- **Translation review**: tracks missing keys / fallback / review queue +
  per-locale (tw/ha/sw/hi) status; never fakes completion → NEEDS_TEST until
  all four are REVIEWED.
- **Persistence**: PASS requires postgres + DATABASE_URL + prisma connected +
  critical writes + a real write/read; **FAIL in in-memory mode**.
- **Invite**: PASS requires a recorded email/SMS test + activation + login;
  **never from provider config alone**; `fakeDelivery` blocks PASS.
- **Offline sync**: PASS requires recorded offline add/complete/artifact +
  reconnect-sync + duplicate-prevention verified.
- **Onboarding**: structural — mode/crop/daily-plan/first-scan ready + **location
  optional** + reaches Home without block; **FAIL if GPS would be required**.

## 13. Final pilot readiness
`__finalPilotProofHealth()` → `{ dailyPlan, scanToTask, postHarvest, outcome,
dataReadiness, translationReview, persistence, invites, offlineSync, onboarding,
score, scoreLabel, verdict, blockers, needsTest }`.
- **GO**: core proofs (daily plan, scan-to-task, persistence, onboarding) all
  PASS and nothing outstanding.
- **GO_WITH_LIMITATIONS**: wired but some proofs still NEEDS_TEST / NEEDS_DATA.
- **BLOCKED**: a core proof FAILs (upload broken, in-memory persistence,
  location loop, daily plan broken).

Dashboards: `/internal/pilot-readiness` (proof board) · `/internal/i18n`
(translation review) · `/internal/qa/offline` (offline field test).

## 14. Governance checks added (all in `build:safe`)
`check-final-pilot-proof`, `check-proof-no-fake-pass`, `check-persistence-proof`,
`check-invite-proof`, `check-outcome-proof`, `check-onboarding-proof`.

## 15. Result
The proof layer is wired, honest, and non-blocking. Until real pilot workflows
run, the proofs sit at NEEDS_TEST / NEEDS_DATA by design — that is the point.
No new architecture layer, no new AI engine, no fake anything.
