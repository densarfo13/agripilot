# Rollback Plan

Status: enterprise gate. The on-call engineer's "undo" button.

Companions: `docs/ops/DEPLOYMENT_RUNBOOK.md`,
`docs/security/INCIDENT_RESPONSE.md`,
`docs/BACKUP_STRATEGY.md`.

---

## 0. Pre-deploy rollback anchor (Pass 2 — May 2026)

**Tag every production-bound merge BEFORE it ships.** A tag is a
no-cost rollback anchor — it costs nothing to create and means
the on-call engineer never has to dig through `git reflog` looking
for the last-known-good SHA.

```bash
# Right after the GitHub UI shows the PR merged:
git fetch origin master
git tag pre-<descriptive-name>  <pre-merge-sha>       # immutable rollback target
git tag post-<descriptive-name> <merge-commit-sha>    # marks the deploy
git push origin pre-<descriptive-name> post-<descriptive-name>
```

Example from the i18n column-split rollout:

```
git tag pre-i18n-cutover  8e9c02c2   # master tip before the merge
git tag post-i18n-cutover 1468242f   # the merge commit
git push origin pre-i18n-cutover post-i18n-cutover
```

Both tags are now visible at `https://github.com/<org>/<repo>/tags`
and stay regardless of any future force-push, garbage-collection,
or branch deletion.

---

## 0a. SHA-drift detection

If `/api/health.gitSha` does NOT match `git rev-parse origin/master`,
production is serving a stale build. Detect with:

```bash
npm run verify:deployment
```

Exit code 3 = SHA mismatch. The on-call engineer should
**investigate before rolling back** — most common cause is an
operator bypassing `scripts/deploy/deploy-railway.mjs` and running
`railway up` from a checkout that wasn't on master tip. The fix
is usually "re-run the canonical deploy script" not "roll back".

---

## 0b. Rollback via the canonical deploy script (preferred)

If a rollback IS the right call, do it through the same script
that ships forward deploys — guarantees the rolled-back container
reports the rollback SHA in `/api/health.gitSha` so the
verification chain stays honest.

```bash
# 1. Reset a worktree to the known-good SHA (or tag).
git worktree add /tmp/rollback pre-i18n-cutover
cd /tmp/rollback

# 2. Link Railway in the worktree.
railway link --project <id> --service <name>

# 3. Deploy (--allow-non-master because we're on detached HEAD).
node scripts/deploy/deploy-railway.mjs --allow-non-master \
  --no-sha-check  # origin/master ≠ rollback target by design

# 4. Verify the new deploy reports the rollback SHA.
curl https://farroway.app/api/health | jq .gitSha
# → should print the pre-<tag> SHA

# 5. Clean up.
cd ~/agripilot && git worktree remove /tmp/rollback --force
```

`--no-sha-check` is required: the rollback intentionally ships a
SHA that doesn't match `origin/master`. The deploy script's
default behaviour assumes you're shipping forward.

---

## 0c. Rollback via Railway dashboard (fastest)

If the canonical script is unavailable (operator at airport with
phone-only access, or the script itself is broken):

1. Go to https://railway.com/project/<project-id>
2. Navigate: agripilot service → Deployments tab
3. Find the last `SUCCESS` deployment with the desired SHA
4. Click the three-dot menu → "Roll back to this deployment"
5. Confirm

Railway reuses the existing build artifact — no rebuild — so
this is faster than the script path (~30s vs ~5 min). The
trade-off is no automatic `/api/health` SHA verification; after
the rollback completes, manually run `npm run verify:deployment
--expect-sha <rollback-sha>` to confirm.

---

## 0d. Post-rollback validation checklist

Run all of these after ANY rollback:

```bash
# 1. /api/health reports rolled-back SHA.
npm run verify:deployment -- --expect-sha <rollback-sha>

# 2. Frontend bundle hash matches the rolled-back build.
curl -sL https://farroway.app/ | grep -oE 'i18n-core-[A-Za-z0-9_]+\.js'
# → cross-reference with the dist/ output from a local
#    `git checkout <rollback-sha> && npm run build` if you need
#    100% certainty.

# 3. No 5xx in the last 5 minutes of Railway logs.
railway logs -d | tail -100 | grep -E '500|502|503'

# 4. Database integrity — Prisma migrations haven't gone backwards.
#    The rolled-back container will REFUSE TO START if it has
#    fewer migrations than the DB; this is intentional. If the
#    rollback target is older than the most-recent migration,
#    follow docs/ops/MIGRATION_ROLLBACK.md instead.
```

If any check fails: STOP. Page the lead engineer. Do not retry
the rollback blindly.

---

## 1. Decision tree

```
Bad symptom in production
       │
       ▼
Did the symptom appear in the last 30 min?
       │
       ├── YES — Probably a deploy regression
       │           │
       │           ▼
       │       Roll back the deploy  →  §2
       │
       └── NO — Probably environmental
                  │
                  ▼
              Is the database compromised / lost data?
                  │
                  ├── YES — Restore from backup  →  §3
                  └── NO  — Operate under degraded mode  →  §4
```

When in doubt, **roll back the deploy first**. Pushing forward
through an unknown regression is rarely faster.

## 2. Roll back the deploy

### 2a. Identify the last known-good deployment

```bash
railway deployment list --limit 10
```

The top entry is the current deploy. The first SUCCESS entry
below it (skip any REMOVED) is the rollback target.

### 2b. Promote it

```bash
railway redeploy --deployment <previous-success-id>
```

### 2c. Verify the rollback landed

```bash
# Watch for build → Online
while true; do
  s=$(railway status 2>&1 | grep -E "status:")
  echo "$s"
  echo "$s" | grep -qE "^.*Online$" && break
  sleep 15
done

# Confirm health
curl -s https://farroway.app/api/health
```

`uptime` should be small (< 60 s) on the first poll after the
rollback — that's how you know a fresh process is serving.

### 2d. Confirm the user-visible symptom is gone

Walk the impacted flow on a real device. If the symptom
persists, the rollback target also has the bug; promote the
next-older SUCCESS deployment.

### 2e. Tag the offending commit

```bash
git tag rollback-from-<short-sha>-<yyyymmdd> <bad-sha>
git push origin rollback-from-<short-sha>-<yyyymmdd>
```

Tagging keeps the bad commit reachable for post-incident review
even if the branch is force-pushed later.

### 2f. Open the post-incident issue

Use the template in `docs/security/INCIDENT_RESPONSE.md` §6.

## 3. Restore from database backup

**This is destructive.** Any data written after the snapshot
timestamp will be lost. Use only when the alternative is
ongoing data corruption.

1. Acquire approval from the on-call security lead.
2. Open a maintenance window — flip the app to read-only mode
   (set `READ_ONLY=true` env var, redeploy).
3. Snapshot the current (broken) database state — even when
   it's broken, you may need it for forensics.
4. Restore the target snapshot via the Railway Postgres
   dashboard.
5. Run `npx prisma migrate deploy` on the restored database to
   ensure the schema matches the running app.
6. Smoke-test on a non-production environment if possible
   before flipping `READ_ONLY=false`.
7. Notify affected users of the window + any data loss.

Backup retention is 30 days (see
`docs/security/DATA_RETENTION.md` §6).

## 4. Operate under degraded mode

When the root cause is upstream (Cloudinary outage, Twilio
outage, scan provider rate-limited), don't roll back — degrade
gracefully:

| Outage | Degraded behaviour |
|---|---|
| Cloudinary | Uploads fall through to local disk via `uploadCleanup` rotation. Surfaces show "Photo saved locally — will sync later." |
| Twilio (SMS) | MFA codes via email only. Sign-up SMS verification skipped (account quarantined to limited features). |
| SendGrid (email) | Critical notifications queue; admin notified. |
| Scan provider AI | Falls back to rule-based classifier (already wired). Low-confidence wording handles the UX. |
| Redis | Rate limiters fall back to in-memory store (per-process; less robust under multi-instance, accept the trade-off). |
| Sentry | Silent no-op. Application logs still ship via Railway. |

Degraded mode never sacrifices safety (no scan crashes the app;
no auth bypass; no tenant leak).

## 5. Rollback drill — quarterly

Run on staging, but follow the exact production procedure:

1. Deploy a deliberately-broken build (a `console.log('BROKEN
   DRILL')` added to the boot path is enough — must not cause
   data corruption).
2. Observe the broken state via `/api/health`.
3. Execute §2 above end-to-end.
4. Confirm rollback target reaches Online + healthy.
5. Document timing in the deploy log.

Target rollback time: **under 5 minutes** from decision to
healthy.

## 6. Communication during rollback

| Audience | Message | Timing |
|---|---|---|
| Engineering | "Rolling back to <id>. ETA 5 min." | Immediate |
| Users (if SEV-1) | In-app banner "We're rolling back a recent change. Sit tight." | Within 5 min |
| Pilot NGO partners | Email if rollback > 15 min OR data was affected. | Within 30 min |

The in-app banner is wired via `pilotMetrics` feature flag —
flipping it does NOT require a deploy.

## 7. Verification checklist after every rollback

- [ ] `railway status` Online for ≥ 10 min continuous.
- [ ] `/api/health` 200 for 10 polls at 30 s intervals.
- [ ] User-visible symptom verified gone on a real device.
- [ ] `git log` shows the rollback tag + the post-incident
      issue created.
- [ ] Sentry events for the rollback window reviewed for any
      hidden regressions.
- [ ] Deploy log updated with rollback timestamp + outcome.
