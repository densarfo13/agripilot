# Incident Response Runbook

Status: enterprise gate. Step-by-step plan for the on-call
engineer when something goes wrong in production.

Companions: `docs/security/SECURITY_OVERVIEW.md`,
`docs/ops/DEPLOYMENT_RUNBOOK.md`, `docs/ops/ROLLBACK_PLAN.md`.

---

## 0. Severity definitions

| Sev | Definition | Target response |
|---|---|---|
| **SEV-1** | Production down. `/api/health` 5xx or `db: 'down'`. Auth completely broken. Data leak suspected. | Page within 5 min. Mitigate within 30 min. Public status update within 60 min. |
| **SEV-2** | Major surface degraded. Scan broken for a cohort. Tenant isolation suspect. Sustained 5xx on a core route. | Acknowledge within 15 min. Mitigate within 2 h. |
| **SEV-3** | Single user / narrow cohort impacted. Recoverable manually. Known workaround. | Acknowledge same business day. Patch within the week. |
| **SEV-4** | Cosmetic / non-blocking. Lint warnings, slow non-critical query. | Track on backlog. |

## 1. First 5 minutes — triage

1. **Confirm symptoms** with a fresh-private-window probe of:
   - `https://farroway.app/api/health` → expect 200 `{status:'ok',db:'ok'}`.
   - Home renders for a known test account.
   - Scan capture → analyze → result completes for a known test photo.
2. **Read the deploy ID** of the affected service:
   ```
   railway status                       # confirm Online vs Crashed
   railway deployment list --limit 5    # latest SUCCESS id
   ```
3. **Read the last commits**:
   ```
   git log --oneline origin/master -10
   ```
4. Note the **request ID** from the user report (every response
   carries an `x-request-id` header via `middleware/requestId.js`).
5. Open Sentry (if `SENTRY_DSN` is set) — filter by `release:
   <commit-sha>` for the affected build.

## 2. First 15 minutes — assess

**If the issue arrived with the latest deploy:**
- Roll back: see `docs/ops/ROLLBACK_PLAN.md` §1.
- Open a post-incident issue with the previous-deploy ID and
  reproduce on staging.

**If the issue is environmental (Redis / Postgres / Cloudinary /
Twilio / SendGrid):**
- Check Railway `All resources`:
  ```
  railway status
  ```
- Confirm dependent service status pages.
- Apply graceful-degradation path (e.g. SMS down → email
  fallback; Cloudinary down → queue scans locally).

**If the issue is a security incident** (suspected breach,
credential leak, data exfiltration, account takeover pattern):
- Skip to §4 immediately.

## 3. First 60 minutes — mitigate

### Common SEV-2 / SEV-1 patterns

| Pattern | Mitigation |
|---|---|
| Scan endpoint 5xx spike | Confirm `scanLimiter` + `scanUserLimiter` not exhausted; flip scan provider env to rule-based fallback. |
| Auth login failures | Check `authLimiter` Redis store. Inspect Twilio + SendGrid status. Promote a previous deployment if a code regression. |
| Rate limit storm | Inspect admin monitoring dashboard for the offending `rate_limit_hit` events; blocklist offending IPs at edge if needed. |
| Database connection storm | Trip Prisma connection pool limit; pause non-essential cron jobs; consider read-only mode for non-mutating routes. |
| Upload validation failure | Inspect `imageUploadValidator` magic-byte rejects in logs; confirm `/uploads` static path still behind `authenticate`. |
| Tenant leak suspected | Stop writes immediately. Snapshot DB. Audit `orgScope.js` invocations for the affected route. Escalate to security review. |

### Standard mitigation commands

```bash
# Promote a previous SUCCESS deployment
railway redeploy --deployment <previous-success-id>

# Verify health endpoint
curl -s https://farroway.app/api/health

# Watch logs (production)
railway logs --tail 200

# Force-clear a poisoned Redis rate limit key
# (only when confident the cap was wrong, never to bypass abuse)
redis-cli DEL "farroway:rl:<limiter>:<key>"
```

## 4. Security incident path

If you suspect an **account takeover**, **data leak**, **secret
leak**, or **active exploitation**:

1. **Do not delete anything.** Preserve evidence.
2. Page the security lead. Note the time of detection.
3. Rotate the suspect credential:
   - JWT signing key → bump `JWT_SECRET`, redeploy, force all
     sessions to re-auth.
   - Database password → rotate via Railway Postgres dashboard,
     update `DATABASE_URL`, redeploy.
   - SendGrid / Twilio / Cloudinary / Sentry / Scan-provider
     keys → rotate at the provider, update Railway env,
     redeploy.
4. If a user's data may have leaked, follow §6.
5. Open an incident ticket; mark SEV-1 if active exploitation.
6. Begin the **24-hour notification clock** if PII may have left
   the platform (see `docs/security/DATA_RETENTION.md` §5).

## 5. Communication

| Audience | Channel | Timing |
|---|---|---|
| On-call | Pager / direct message | Immediate |
| Engineering | `#farroway-incidents` (or equivalent) | Within 15 min |
| Pilot NGO partners | Email + in-app notice | Within 60 min for SEV-1 |
| End users (farmers / gardeners) | In-app banner via `pilotMetrics` flag | Within 60 min for SEV-1 |
| Regulators / DPAs | Per data-protection rules | Per `DATA_RETENTION.md` §5 |

Templates:

```
Subject: Farroway service incident — [SEV-1|2|3]

What:       <one-sentence summary>
When:       <UTC start time>
Impact:     <who is affected, what they see>
Status:     <investigating | mitigated | resolved>
Next:       <next checkpoint time>
Workaround: <if any>
```

## 6. Post-mitigation

1. Confirm `/api/health` 200 for 10 minutes continuous.
2. Confirm the failing user flow on a real device.
3. Pull metrics from the admin monitoring dashboard for the
   impact window.
4. Write the post-incident review within 48 h. Required sections:
   - Timeline (detected → mitigated → resolved).
   - Root cause (technical + organisational).
   - What worked / what didn't.
   - Permanent fixes + their owners.
   - Drill recommendations.

## 7. Drill schedule

- **Quarterly** — rollback drill on a staging deploy.
- **Quarterly** — restore from latest Postgres backup (verify
  `docs/BACKUP_STRATEGY.md`).
- **Bi-annually** — table-top exercise of a SEV-1 with rotated
  on-call engineers.

## 8. On-call contacts

Maintained out-of-band in the operator runbook. Required roles:

- Engineering on-call (primary)
- Engineering on-call (secondary)
- Security lead
- Data-protection officer
- Pilot partner liaison
