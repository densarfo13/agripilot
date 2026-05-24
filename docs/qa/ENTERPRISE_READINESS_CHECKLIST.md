# Enterprise Readiness Checklist

Status: enterprise gate. Walk this list before signing a pilot
agreement with an institutional partner (NGO programme,
government extension service, agricultural cooperative).

Companions:
- `docs/qa/SOFT_LAUNCH_READINESS.md`
- `docs/qa/REAL_DEVICE_QA_CHECKLIST.md`
- `docs/qa/INTELLIGENCE_ORCHESTRATION_QA.md`
- `docs/qa/SCAN_PRODUCTION_HARDENING.md`
- `docs/security/SECURITY_OVERVIEW.md`
- `docs/security/INCIDENT_RESPONSE.md`
- `docs/security/DATA_RETENTION.md`
- `docs/ops/DEPLOYMENT_RUNBOOK.md`
- `docs/ops/ROLLBACK_PLAN.md`

---

## A. Security — hard gates

- [ ] Every admin router calls `router.use(authenticate);
      router.use(requireMfa); router.use(extractOrganization);`
      near the top of the file.
- [ ] Every state-changing admin endpoint writes an audit log
      entry via `writeAuditLog`.
- [ ] No `/api/test|debug|dev|internal|_` routes exist.
- [ ] Scan endpoints rate-limited per-IP AND per-user (`scanLimiter`
      + `scanUserLimiter`).
- [ ] `/uploads` static path mounted behind `authenticate`.
- [ ] `imageUploadValidator()` present in every photo upload
      route's middleware chain.
- [ ] `sodGuard` + `requireStepUp` present on role-change /
      org-move / archive endpoints.
- [ ] JWT secret + refresh secret are distinct random strings ≥
      32 bytes each.
- [ ] CORS origin allowlist is environment-specific (no `*` in
      production).
- [ ] No secrets returned in any API response (manual review of
      OpenAPI spec / route surface).

## B. Tenant isolation

- [ ] `extractOrganization` middleware populates `req.org` on
      every protected route.
- [ ] Cross-org queries gated behind `super_admin` role AND
      explicit `isCrossOrg` flag (`orgScope.js`).
- [ ] Sample query proves a `regular_admin` cannot read another
      org's farmer roster.
- [ ] Audit log includes `organizationId` on every entry.

## C. Observability

- [ ] `SENTRY_DSN` set on production Railway. Test event sent
      within the last 30 days.
- [ ] `VITE_SENTRY_DSN` set so the frontend ships errors.
- [ ] `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` set
      so source maps upload on each deploy.
- [ ] Admin monitoring dashboard receives `rate_limit_hit`,
      `scan_failed`, `notification_failed`, `offline_sync_failed`
      events.
- [ ] `/api/health` polled by an external uptime monitor every
      60 s. Alert routes to on-call.

## D. Reliability

- [ ] `/api/health` returns `{ status, db, uptime, timestamp,
      version }` and is mounted at both `/api/health` and
      `/health`.
- [ ] Boot-time env validation prints a clear FAILED line for
      each missing non-fatal env (email, sms, scan provider).
- [ ] App boot does NOT crash on missing optional env — only on
      missing critical (DATABASE_URL, JWT_SECRET).
- [ ] Background jobs use the Redis-backed queue when Redis is
      available; fall back to in-process when not.
- [ ] Backup restore drilled within the last 90 days
      (`docs/BACKUP_STRATEGY.md`).
- [ ] Rollback drill completed within the last 90 days
      (`docs/ops/ROLLBACK_PLAN.md` §5).

## E. Data governance

- [ ] Privacy Policy + Terms accepted at sign-up; acceptance
      timestamps stored on the user row.
- [ ] Image / ML-training consent captured separately
      (`scan_training_events.consent_state`).
- [ ] `POST /api/v1/me/export` returns the data bundle within
      the documented async window.
- [ ] `POST /api/v1/me/delete-request` requires MFA and triggers
      the 30-day soft-delete cycle.
- [ ] Sentry breadcrumbs exclude `Authorization` headers.
- [ ] No raw image bytes in any analytics or log payload.

## F. NGO / institutional admin readiness

- [ ] An institutional admin can sign in and see ONLY their
      organisation's farmers.
- [ ] Programme dashboards (`NgoImpactPage`, `FundingHub`,
      `AdminAnalyticsPage`) render with org-scoped data only.
- [ ] CSV export from the admin surfaces produces a non-empty
      file with no PII leakage outside the org boundary.
- [ ] Issue reporting queue (`/api/issues`) routes new tickets
      to the correct admin cohort.
- [ ] Role-based dashboards: `super_admin` sees cross-org;
      `institutional_admin` sees own-org; `regular_admin` sees
      limited surface; `farmer` sees own-data.
- [ ] Audit log readable from the admin UI for the org's own
      actions (super_admin sees all; institutional_admin sees
      own-org).

## G. Quality gates (must all be exit 0)

- [ ] `npm run lint`
- [ ] `cd server && npm test`
- [ ] `npm run check:intelligence`
- [ ] `npm run check:translations`
- [ ] `npm run check:assets`
- [ ] `npm run check:urls`
- [ ] `npm run check:icons`
- [ ] `npm run validate:production`
- [ ] `npm run build`
- [ ] `npm run build:safe` (chains six of the above + Vite)

## H. UX safety nets

- [ ] Simple Mode is the default on first install.
- [ ] Every scan result with `confidenceLabel: needs_review`
      shows the calm "Photo saved. Review needed." path —
      never a broken `?` image.
- [ ] Hedged wording (possible / may / likely / monitor) on
      every scan and risk card.
- [ ] Chemical treatment cards carry the "Consult a local
      agricultural expert" disclaimer.
- [ ] Marketplace links from unknown sources fall back to the
      "Check with a local supplier" envelope.

## I. Documentation

- [ ] `README.md` reflects the current architecture.
- [ ] `docs/RAILWAY_ENV_CHECKLIST.md` is up to date.
- [ ] `docs/LAUNCH_CHECKLIST.md` + `docs/LAUNCH_PLAYBOOK.md`
      reflect the current pilot procedures.
- [ ] All six enterprise docs present and referenced from this
      checklist.

## J. Operational sign-off

- [ ] On-call rotation defined; primary + secondary engineer +
      security lead + data-protection officer named.
- [ ] Pilot partner liaison identified for the cohort.
- [ ] First-24h support roster published.
- [ ] Day-1 + Day-7 metric review meeting on the calendar.
- [ ] Rollback decision authority documented (who can press
      the button on a SEV-1).

---

## Final verdict template

After walking sections A–J:

- [ ] A + B + C + D + E + G — ALL GREEN (no exceptions)
- [ ] F + H + I + J — green or documented residual risk

Verdict (circle one):

  **ENTERPRISE PILOT READY** / SOFT-LAUNCH READY ONLY / NEEDS MORE HARDENING / NOT READY

Reviewer: ____________ Date: __________ Commit: ____________

Cohort cap recommendation: ____ users
First-week metric review: __________
