# Data Retention Policy

Status: enterprise gate. Defines what we keep, how long, and how
a farmer or NGO partner can ask for it back / ask us to delete
it.

Companions: `docs/security/SECURITY_OVERVIEW.md`,
`docs/security/INCIDENT_RESPONSE.md`.

---

## 1. Data classes

| Class | Examples | Sensitivity | Default retention |
|---|---|---|---|
| **Account** | email, hashed password, phone, language, role, organizationId | High (PII) | Lifetime of account + 30 days post-deletion request |
| **Farm / Field** | farm name, region, soil notes, planting date, crop, field boundary polygon | Medium | Lifetime of account |
| **Operational** | tasks, watering logs, harvest records, notifications | Medium | 2 years rolling |
| **Scan content** | uploaded photos, classifier outputs, confidence labels, follow-up tasks | High (potentially identifiable) | 12 months — see §3 |
| **Audit logs** | who did what, when, IP address, request ID | High (PII) | 7 years (regulatory baseline) |
| **Analytics events** | scan_succeeded, task_completed, notification_opened, rate_limit_hit | Low (no PII) | 2 years aggregate; raw events 90 days |
| **Backups** | encrypted DB snapshots | Mirrors source class | 30 days rolling |
| **Sentry events** | symbolicated stack traces, breadcrumbs | Medium (no raw photos, no free-text personal content) | 90 days |

## 2. PII minimisation

- **No raw image data in analytics.** Scan analytics carry only
  the structured verdict (`issueCategory`, `confidenceLabel`,
  `urgency`) — never the photo bytes or filename.
- **No free-text personal content in audit logs.** The audit
  payload carries action + status transitions + structured
  metadata. Free-text fields (notes, farm name) are referenced
  by id, not duplicated into the log row.
- **No secrets in any response.** Boot-time `validateEmailConfig`
  / `validateSmsConfig` confirms presence but never echoes the
  secret. Sentry breadcrumbs exclude `Authorization` headers.
- **Server-side filename rewrite.** `uploadValidator.js` renames
  uploads to `<uuid>.<ext>`; original filename is kept on
  `req.upload.originalName` for the audit log only.

## 3. Scan-content retention

Scan photos are higher-risk than operational data because:
- They may contain incidental human imagery if the framing fails.
- They may identify a specific field through landmark features.

Retention rules:

- **12 months** default. After 12 months the binary is deleted
  from object storage; the structured verdict + audit row are
  retained per §1.
- **Immediate deletion on user request** (see §4).
- **Pilot opt-in for ML training**: photos contributed to the
  training set carry an explicit consent stamp in
  `scan_training_events.consent_state` — without that stamp the
  binary is excluded from any training corpus.
- **Cross-org**: photos never cross `organizationId`. The
  `orgScope.js` middleware enforces the boundary on every read.

## 4. Subject-access requests (SAR) — export + deletion

The platform supports user-initiated data requests:

### 4a. Export (data portability)

Endpoint: `POST /api/v1/me/export` (authenticated).

Returns a JSON bundle containing:
- account profile
- farm + field records
- planted crops + lifecycle history
- tasks + watering + harvest logs
- scan history (structured verdict + thumbnail reference; the
  full image is included only if the user explicitly requests it
  via the `?includePhotos=true` flag)
- notification history (last 12 months)
- audit log entries pertaining to the user's own actions

Async — job runs in the background, link emailed when ready.
TTL on the link: 7 days.

### 4b. Deletion

Endpoint: `POST /api/v1/me/delete-request` (authenticated; MFA
required).

Two-phase:
1. **Soft delete** — account marked `archivedAt`, sessions
   revoked, refresh tokens invalidated, scheduled notifications
   cancelled. Lasts **30 days** during which the user may
   reactivate by signing in. Backups also retained for this
   window.
2. **Hard delete** — at day 30, a cron job:
   - Deletes user row and all foreign-key-cascade rows.
   - Removes uploaded photos from object storage.
   - Replaces references in audit + analytics with the
     `<deleted-user-uuid>` token (audit log integrity preserved).
   - Confirms via email.

### 4c. NGO / institutional admin delete

When an institutional admin requests deletion of an entire
organisation's data, the SAR flow runs at the org level and
fans out to every farmer record under that org. The
`adminArchiveUser` + `adminUnarchiveUser` codepaths handle the
single-user case; org-level deletion is a documented runbook
step in `docs/ops/DEPLOYMENT_RUNBOOK.md` §6.

## 5. Breach notification

Trigger: any confirmed unauthorised access to PII or scan content.

- **24-hour clock** — internal notification to security lead +
  data-protection officer + leadership.
- **72-hour clock** — notification to the relevant data
  protection authority (GDPR-style baseline; adapt per
  jurisdiction).
- **Affected-user notice** — within 72 hours of confirmation,
  by the most direct channel (in-app + email; SMS if email
  bounces). Notice MUST include: nature of the breach,
  categories of data affected, what we are doing, what the
  user can do, contact path for follow-up.

See `docs/security/INCIDENT_RESPONSE.md` §4 for the operational
flow.

## 6. Backup retention

- Postgres snapshots: nightly, **30 days rolling** retention.
- Encrypted at rest by the provider (Railway-managed Postgres).
- Restore tested quarterly per `docs/BACKUP_STRATEGY.md`.
- Backup access is super-admin only; access events themselves
  are audited.

## 7. Consent capture

Three opt-ins captured at sign-up / on first use:

| Consent | When | Required? | Where stored |
|---|---|---|---|
| Terms of Use | Sign-up | Required to use the platform | `users.tosAcceptedAt` |
| Privacy Policy | Sign-up | Required to use the platform | `users.privacyAcceptedAt` |
| Image / ML training | First scan | **Optional** | `scan_training_events.consent_state` |

Each consent record stores: `acceptedAt`, `policyVersion`,
`acceptedFromIp`, `acceptedFromUserAgent`. Withdrawal is
self-service via Settings → Privacy.

## 8. Reviewer checklist

- [ ] Confirm `users.archivedAt` cascade behaviour in the schema.
- [ ] Confirm `POST /api/v1/me/export` exists and is async.
- [ ] Confirm `POST /api/v1/me/delete-request` requires MFA.
- [ ] Confirm scan_training_events carries `consent_state`.
- [ ] Confirm Sentry scope strips `Authorization` headers.
- [ ] Confirm `/uploads` is behind `authenticate`.
- [ ] Confirm cron job for the 30-day hard-delete is scheduled.
- [ ] Confirm backup restore drill timestamp is within 90 days.
