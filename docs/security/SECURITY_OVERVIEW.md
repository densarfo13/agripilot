# Security Overview

Status: enterprise gate. Source of truth for the security
posture an NGO procurement / institutional partner reviews before
sending farmers into the platform.

Companions:
- `docs/security/INCIDENT_RESPONSE.md`
- `docs/security/DATA_RETENTION.md`
- `docs/qa/ENTERPRISE_READINESS_CHECKLIST.md`
- `docs/ops/DEPLOYMENT_RUNBOOK.md`
- `docs/ops/ROLLBACK_PLAN.md`

---

## 1. Identity, Auth, MFA

| Layer | Where | Behaviour |
|---|---|---|
| Authentication | `server/src/middleware/auth.js` | JWT bearer required on every protected route. Tokens issued at `/api/v2/auth/*`, refresh path separate from login. |
| Multi-factor auth | `server/src/middleware/requireMfa.js` | Required on every admin route + on step-up paths. Codes via `auth/smsVerification`. |
| Step-up auth | `server/src/middleware/requireStepUp.js` | Sensitive mutations (role change, org move, archive) require fresh re-auth even when the JWT is valid. |
| Auth rate limit | `server/src/app.js` `authLimiter` | 30 attempts / 5 min / IP. Successful requests do not count. |
| Session expiry | JWT TTL + refresh rotation | Refresh tokens rotate on use; revoked sessions visible in admin audit log. |

## 2. RBAC / ABAC

| Layer | Where | Behaviour |
|---|---|---|
| Role gate | `server/src/middleware/auth.js#authorize` | `authorize('super_admin', 'institutional_admin', …)` per route. |
| Role aliases | `server/src/middleware/roleAliases.js` | Centralised role normalisation — no string-comparison drift between modules. |
| Row-level ownership | `server/src/middleware/requireOwnership.js` | Object-level guard (`userId === resource.userId`) on personal records. |
| Tenant isolation | `server/src/middleware/orgScope.js` | `extractOrganization` populates `req.org`. Queries scope to `organizationId`. Cross-org access requires `super_admin` AND `isCrossOrg=true` flag. |
| Segregation of duties | `server/src/middleware/sodGuard.js` | The same admin cannot both originate AND approve a high-risk action. |

## 3. Rate limiting (Redis-backed when available, memory fallback)

| Limiter | Window | Cap | Key |
|---|---|---|---|
| `apiLimiter` (default) | 60 s | 200 req | IP |
| `authLimiter` | 5 min | 30 req | IP (success-skip) |
| `scanLimiter` | 60 s | 30 req | IP |
| `scanUserLimiter` | 60 s | 60 req | **userId** (falls back to IP if unauthenticated) |
| `fundingLimiter` | 60 s | 60 req | IP |
| `sellLimiter` | 60 s | 60 req | IP |
| `uploadLimiter` | per-route | configured per handler | IP |

Every limiter ships a `_onRateLimited` handler that writes a
`rate_limit_hit` clientEvent to the admin monitoring dashboard
on excess. No PII in the payload.

## 4. Upload validation (defence in depth)

`server/src/middleware/uploadValidator.js#imageUploadValidator()`:
- **MIME allowlist** — only `image/jpeg`, `image/png`, `image/webp`.
- **Magic-byte sniff** — first 12 bytes must match the claimed
  MIME. Defeats SVG/HTML/EXE/PDF/ZIP smuggling under a wrong
  content-type.
- **Size cap** — defaults to 10 MB; configurable per route.
- **Server-side rename** — file renamed to `<uuid>.<ext>` after
  validation. The sanitized original filename is exposed only on
  `req.upload.originalName` for audit logging.

`server/src/middleware/uploadCleanup.js` removes orphaned uploads
on a scheduled sweep. The `/uploads` static path is mounted
behind `authenticate` — files are never publicly readable.

## 5. Audit logging

`server/src/modules/audit/service.js#writeAuditLog`:
- Non-blocking by design — callers use `.catch(() => {})` so a
  log failure never stalls a user action.
- Captures: action, userId, applicationId, organizationId,
  previous/new status, free-form details, ipAddress.
- FK errors (orphaned userId) are tolerated — entry still
  written with null userId.
- Surfaced in admin UI via `/api/audit` + `/api/v2/audit`.

Every state-changing admin endpoint calls `writeAuditLog` from
its `service.js` layer. Reviewers can grep for callers via
`Grep("writeAuditLog\\(")`.

## 6. Secrets & environment

| Class | Validated at boot | Source |
|---|---|---|
| Database | `validateDatabaseConfig` | `DATABASE_URL` |
| Email (SendGrid) | `validateEmailConfig` | `SENDGRID_API_KEY` |
| SMS (Twilio) | `validateSmsConfig` | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` |
| Scan provider | scan-provider check in `server/src/server.js` | `PLANT_ID_API_KEY` / `PLANTNET_API_KEY` / `SCAN_API_KEY` / `OPENAI_API_KEY` |
| Sentry | `_readDsn()` in `src/lib/sentry.js` | `SENTRY_DSN` / `VITE_SENTRY_DSN` |

Boot prints "config check FAILED" warnings for any missing
non-fatal env. Missing secrets never crash the process — they
disable the corresponding feature (rule-based scan fallback,
SMS code skipped, Sentry no-op).

No secrets are logged. No secrets are returned in any API
response. The audit log payload deliberately excludes header
contents.

## 7. CSRF / request integrity

| Layer | Where | Behaviour |
|---|---|---|
| Request ID | `server/src/middleware/requestId.js` | Every request stamped with a UUID for log correlation. |
| Idempotency | `server/src/middleware/idempotency.js` | Mutating endpoints honour `Idempotency-Key` header. Replays return the original response. |
| Dedup guard | `server/src/middleware/dedup.js` | Short-window in-memory dedup on retry-vulnerable mutations. |
| CORS | `server/src/app.js` cors config | Origin allowlist enforced per environment. |

## 8. No exposed debug routes

Confirmed via grep — no `/api/test`, `/api/debug`, `/api/dev`,
`/api/internal`, `/api/_*` paths exist. The only "system" route
is `/api/system` and it is itself guarded by `authenticate +
authorize('super_admin')`.

## 9. Observability hooks (Sentry + analytics)

- `@sentry/node` server-side: `server/src/lib/sentry.js` —
  request handler + tracing handler + error handler when
  `SENTRY_DSN` is set; silent no-op otherwise.
- `@sentry/vite-plugin` build-side: uploads hidden source maps
  when `SENTRY_AUTH_TOKEN` is set, then deletes `.map` files
  from `dist/`. Sourcemaps never serve publicly.
- `analyticsStore` + `moatTrack` — surface events flow to the
  admin monitoring dashboard. PII-free (no raw image data, no
  free-text personal content).

## 10. Reviewer checklist (one page)

- [ ] Confirm `validateDatabaseConfig` / `validateEmailConfig` /
      `validateSmsConfig` run at boot.
- [ ] Verify every admin route's router file calls
      `router.use(authenticate); router.use(requireMfa);
      router.use(extractOrganization);` near the top.
- [ ] Verify every state-changing admin endpoint calls
      `writeAuditLog` after the mutation.
- [ ] Confirm `/uploads` is behind `authenticate` in `app.js`.
- [ ] Confirm `imageUploadValidator()` is in every scan/evidence
      upload route's middleware chain.
- [ ] Confirm `scanLimiter` + `scanUserLimiter` cap `/api/scan/*`.
- [ ] Confirm no `/api/test|debug|dev|internal|_` routes exist:
      `Grep -r "app\\.use\\('/api/(test|debug|dev|internal|_)"`.
- [ ] Confirm `SENTRY_DSN` set on the deploy environment for
      runtime error capture.
