# Deployment Runbook

Status: enterprise gate. The operator's playbook for shipping a
new build to production safely.

Companions: `docs/ops/ROLLBACK_PLAN.md`,
`docs/qa/SOFT_LAUNCH_READINESS.md`,
`docs/qa/LIVE_SMOKE_CHECKLIST.md`,
`docs/LAUNCH_CHECKLIST.md`,
`docs/RAILWAY_ENV_CHECKLIST.md`.

---

## 1. Standard deploy

### 1a. Pre-flight (run from `agripilot/`)

```bash
git fetch --prune && git status                       # clean tree
npm run lint                                          # 0 errors
cd server && npm test && cd ..                        # 481/481 files passing
npm run build:safe                                    # exit 0
npm run validate:production                           # exit 0
```

All four must be exit 0 / green. Do NOT push if any step fails.

### 1b. Commit + push

```bash
git add <files>
git commit -m "<type>(<scope>): <subject>"
git push origin master
```

Commit message conventions:
- `feat(<scope>):` new capability
- `fix(<scope>):` bug fix
- `chore(<scope>):` non-feature work (deps, configs)
- `docs(<scope>):` docs-only change
- Subject line ≤ 70 chars; body explains the why.

### 1c. Trigger Railway deploy

```bash
railway redeploy --yes
```

Watch for build:

```bash
# Poll until Online OR Failed/Crashed
while true; do
  s=$(railway status 2>&1 | grep -E "status:")
  echo "$s"
  echo "$s" | grep -qE "Failed|Crashed" && break
  echo "$s" | grep -qE "^.*Online$" && break
  sleep 15
done
```

Typical Railway build time: 90–120 s.

### 1d. Post-deploy verification (≤ 5 min)

1. `railway status` → `● Online`.
2. `railway deployment list --limit 3` → top entry SUCCESS.
3. `curl -s https://farroway.app/api/health` → 200,
   `{status:'ok', db:'ok', uptime: <small>}`.
4. Live smoke walk per `docs/qa/LIVE_SMOKE_CHECKLIST.md`.

Failures at step 3 → roll back (`docs/ops/ROLLBACK_PLAN.md`).

## 2. Hotfix path

For SEV-1 / SEV-2 fixes that can't wait for the standard cycle:

1. Branch from current production commit:
   ```
   git fetch
   git checkout -b hotfix/<short-name> origin/master
   ```
2. Land the minimum-viable patch. Add a test for the regression.
3. Run gates 1a.
4. Merge fast-forward into master:
   ```
   git checkout master && git pull
   git merge --ff-only hotfix/<short-name>
   git push origin master
   ```
5. Deploy per 1c.
6. Schedule a follow-up PR to land the broader fix if 4 was the
   minimum patch.

Hotfix commits MUST land on master (no long-lived hotfix branch).

## 3. Required environment variables

Authoritative list in `docs/RAILWAY_ENV_CHECKLIST.md`. Critical
groups:

| Group | Vars | Effect when missing |
|---|---|---|
| **Database** | `DATABASE_URL` | App crashes at boot |
| **Auth** | `JWT_SECRET`, `JWT_REFRESH_SECRET` | App crashes at boot |
| **Email** | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | Email features no-op (warning) |
| **SMS** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS no-op (warning) |
| **Cloudinary** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Uploads fall through to local disk |
| **Scan AI** | `PLANT_ID_API_KEY` / `PLANTNET_API_KEY` / `SCAN_API_KEY` / `OPENAI_API_KEY`, `SCAN_PROVIDER_PROFILE` | Scan falls back to rule-based classifier (warning) |
| **Redis** | `REDIS_URL` | Rate limiters fall back to in-memory store |
| **Sentry (frontend)** | `VITE_SENTRY_DSN` | Frontend init silent no-op |
| **Sentry (backend)** | `SENTRY_DSN` | Backend init silent no-op |
| **Sentry build** | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Source maps NOT uploaded — events show as obfuscated stacks |
| **Release tag** | `SENTRY_RELEASE` / `RAILWAY_GIT_COMMIT_SHA` / `VITE_BUILD_ID` | Auto-resolved from Railway in prod; manual elsewhere |

`validateDatabaseConfig` / `validateEmailConfig` / `validateSmsConfig`
print a `config check FAILED` warning at boot for missing
non-fatal env.

## 4. Database migrations

```bash
cd server
npx prisma migrate dev --name <descriptive-name>     # local
git add prisma/migrations/<timestamp>_<name>
git commit -m "chore(db): <name>"
# normal deploy path applies migrations on Railway via
# `npx prisma migrate deploy` in the start command.
```

**Forward-only safety rules:**
- Never `prisma migrate reset` on production.
- Never rename a column in a single migration — add new column,
  backfill, switch reads, drop old column (4 deploys minimum).
- Add a feature flag (env var) for any migration that could
  break the previous app version while the rollout is partial.

## 5. Deploy verification script

`npm run validate:production` runs the readiness checks before
shipping. It validates:
- All required env vars are present in the runtime.
- Health endpoint contract matches the spec.
- Prisma schema is in sync with the database.
- No drift between the lock file and `package.json`.

Exit non-zero blocks the deploy.

## 6. Org-level destructive operations

When an institutional admin requests deletion of an entire
organisation's data (per `docs/security/DATA_RETENTION.md` §4c):

1. Confirm the request in writing from the org owner.
2. Open a deploy window — pause cron jobs that touch the org.
3. Run a Postgres backup snapshot via Railway and confirm
   restorability before any destructive query.
4. Run the org-deletion procedure (SQL transcript stored
   out-of-band).
5. Verify cascade — `users`, `farms`, `scans`, `tasks`,
   `notifications`, `auditLogs` all clear under the
   organizationId.
6. Re-enable cron jobs.
7. Notify the org owner of completion + offer the export
   bundle.

This is destructive and irreversible past the backup retention
window. It is a manual procedure on purpose.

## 7. Deploy log

The operator should maintain a running deploy log
(out-of-band) capturing for each deploy:

- Date / time (UTC)
- Operator
- Commit SHA
- Deployment ID returned by Railway
- Verification result (Live smoke green / issues)
- Any rollback or incident triggered by the deploy

Cross-reference with `docs/LAUNCH_CHECKLIST.md` for major releases.

## 8. Routine drills

- **Quarterly** — rollback drill (`docs/ops/ROLLBACK_PLAN.md`).
- **Quarterly** — backup restore on staging.
- **Bi-annually** — DR failover dry run.
- **Per release** — `docs/qa/LIVE_SMOKE_CHECKLIST.md` walked
  end-to-end on a real device.
