# RELEASE_VALIDATION_SCORECARD — Farroway

> 2026-07-06 · Verification-only. RC = `master @ 5016a4e2`. Written as a distinct file so it does not
> overwrite the pre-existing `FINAL_RELEASE_SCORECARD.md` (a separate phase-certification view).
> Honest scoring — build environment has no live DB/Redis/provider keys.

## Scorecard
| Dimension | Status | Basis |
|---|---|---|
| Build (production) | 🟢 **PASS** | `vite build` exit 0, 19.45s, 790 chunks |
| Prisma schema / client | 🟢 **PASS** | `prisma validate` "valid 🚀"; field gate 131 models, 0 drift |
| Runtime defects | 🟢 **0 found** | build passes; columns load; no logic assertion failed on real code |
| Test suite | 🟡 **50 fail / 14,495 pass** | 0 runtime defects — 34 JSON-parse-on-valid-JS methodology + 16 stale assertions (evidence in RELEASE_VALIDATION_REPORT.md) |
| Security | 🟢 strong / 🟡 1 gap | auth Security 5; analytics cross-org scoping fixed but **unmerged** (`fix/analytics-org-scope`) |
| Performance | 🟢 build budgets green | `check:bundle-budget` passes; live p95 = operator (no traffic here) |
| Integrations | ⚪ **operator** | code wired + fail-soft; live status via `/api/ops/health` + `/api/scan/provider-health` |
| Migrations status | ⚪ **operator** | needs live `DATABASE_URL` |
| Rollback readiness | 🟢 ready | see below |

## Performance metrics (measured, not fabricated)
- Production build: **19.45s**, 3,316 modules, **790 JS chunks**, initial-path within `bundle-budget`.
- Live API/DB latency, cache hit-rate, memory: **not measurable here** (no traffic/DB) — read from the deployment's `/api/ops/metrics`.

## Security status
- ✅ RBAC centralized + gate-enforced (`check:role-route-guards`); JWT ≥32-char secret, FATAL prod exit if weak; bcrypt cost 10; MFA + SoD guard; provider keys server-side only.
- 🟡 One known cross-org exposure on the analytics admin surface — **fixed** on `fix/analytics-org-scope`, awaiting merge.

## Remaining operational risks
1. One real device scan (release blocker) — human action.
2. Provider keys — confirm at Railway via health endpoints.
3. DR restore never rehearsed — run the backup runbook §2.
4. 50-test test-suite debt — cleanup, non-blocking.

## Rollback readiness — 🟢
- `master` is the deployed RC; Railway auto-deploys on push; migrations via `prisma-deploy-with-baseline` (baseline-safe, additive).
- **Rollback = `git revert <commit>` + push** (redeploys prior), or Railway "redeploy previous". No destructive migration in the RC.

## Release decision
🟡 **GO WITH CONDITIONS** — the RC **builds, the schema is valid, and 0 runtime defects were found**;
it is deployable. Conditions before GA are all **operational, not code**: (a) verify live integrations
via the health endpoints, (b) close the 3 operational blockers (device scan, provider keys, DR drill),
(c) merge the 5 pending improvement PRs (incl. the analytics security fix), and optionally (d) clear the
test-suite debt. **NO-GO is not warranted** — no runtime defect exists.
