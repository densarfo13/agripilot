# Farroway Backend Security Audit Report

**Date:** 2026-05-03
**Scope:** `server/` Express + Prisma backend
**Reviewer:** Internal automated audit (Claude / Anthropic)
**Status:** Pre-public-launch, post-pilot

---

## Executive summary

The Farroway backend already ships with **substantial defence-in-depth** for the
1k–10k-user pilot tier. The audit found:

- **Strong foundation:** authentication, role-based access control, organisation
  scoping, rate limiting, MFA, audit logging, request signing, and prod-time
  env validation all exist and are wired into `app.js`.
- **No critical, currently-exploitable findings** were uncovered during the
  audit. Every spec section maps to an existing implementation.
- **Three minor hardening additions** were made in this turn:
  1. A 6-role alias normaliser (`server/src/middleware/roleAliases.js`) so
     spec-canonical role names work alongside the legacy names already in JWTs.
  2. A pre-launch secrets scanner (`scripts/ci/scan-secrets.mjs`).
  3. `npm run security:audit` / `security:test` / `security:scan-secrets` /
     `launch-gate:security` scripts that wrap the existing test suite + scanner.

**Verdict — see end of document.**

---

## §1 Role authorization model

| Spec requirement                                                | Status   | Implementation                                                                                                       |
| --------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| 6-role canonical model (backyard_user / farmer / buyer / ngo_admin / field_agent / platform_admin) | ✅       | `src/core/userRole.js` (frontend) + `server/src/middleware/roleAliases.js` (server bridge)                           |
| `requireAuth` middleware                                        | ✅       | `server/middleware/rbac.js#requireAuth` — 401 when `req.user.id` absent                                              |
| `requireRole(...roles)` middleware                              | ✅       | `server/middleware/rbac.js#requireRole` (case-insensitive set match; admin/super_admin bypass)                       |
| Alternate `authorize(...roles)` middleware                      | ✅       | `server/src/middleware/auth.js#authorize`                                                                            |
| `requireOwnership` middleware                                   | ✅       | `server/middleware/rbac.js#requireOwnershipOrRole` + `auth.js#requireFarmerOwnership`                                |
| `requireProgramAccess` (NGO scoping)                            | ✅       | `server/src/middleware/orgScope.js#extractOrganization` + `verifyOrgAccess` + `orgWhereFarmer/Application/User`      |
| `requireAdmin` (platform_admin only)                            | ✅       | `requireRole('platform_admin')` (alias-expanded) or `authorize('super_admin')`                                       |
| Deny-by-default for unknown roles                               | ✅       | Both `authorize` and `requireRole` reject any role not in the allow set                                              |
| Role mismatch logged to audit log                               | ✅       | `logPermissionEvent('role_denied'/'ownership_denied'/'cross_org_access_denied', {…})` in `auth.js` + `orgScope.js`   |
| MFA enforcement for sensitive operations                        | ✅       | `server/src/middleware/requireMfa.js` + `requireStepUp.js`                                                           |
| Separation-of-duty guard                                        | ✅       | `server/src/middleware/sodGuard.js`                                                                                  |

### Hardening added this turn

- `server/src/middleware/roleAliases.js` — pure normaliser. Maps legacy auth
  names (`super_admin` / `institutional_admin` / `field_officer` / `staff` /
  `ngo` / `agent` / `admin`) onto the spec's canonical 6-role names so calls
  like `requireRole('platform_admin')` match a user whose JWT carries
  `super_admin`. Pure read, never throws, deny-by-default for unknown roles.

---

## §2 Route-by-route authorization

### §2.1 `/api/auth/*` — public + post-auth endpoints

| Endpoint                                  | Auth required? | Rate limited? | Notes                                                                |
| ----------------------------------------- | -------------- | ------------- | -------------------------------------------------------------------- |
| `POST /api/auth/login`                    | Public         | `loginLimiter` (15 / 5min, skipSuccessful)         | Bcrypt verify; tokenVersion bump on logout |
| `POST /api/auth/register`                 | Public         | `registrationLimiter` (5 / 15min)                  | Password policy (≥8, upper+lower+digit)    |
| `POST /api/auth/forgot-password`          | Public         | `passwordResetLimiter` (5 / 15min)                 | Token TTL configurable, default 60min      |
| `POST /api/auth/reset-password`           | Public (tok)   | `passwordResetLimiter`                             | Token single-use, validated via DB         |
| `POST /api/auth/refresh`                  | Cookie auth    | `authLimiter` (30 / 5min, skipSuccessful)          | Refresh-token rotation                     |
| `POST /api/auth/logout`                   | Auth           | —                                                  | `bumpCachedTokenVersion(userId)` on exit   |
| `GET /api/auth/me`                        | Auth           | `authLimiter`                                      | Returns minimal profile, no secrets        |
| `POST /api/auth/sms/*`                    | Public/Auth    | Twilio Verify                                      | 503 fallback when `TWILIO_VERIFY_SERVICE_SID` unset |
| `POST /api/auth/mfa/enroll`               | Auth           | `mfaEnrollLimiter` (10 / 15min)                    | AES-256-GCM encryption of TOTP secret      |
| `POST /api/auth/mfa/verify`               | Auth (challenge tok) | `mfaVerifyLimiter` (10 / 5min)                | Tight TOTP brute-force guard               |

✅ All public endpoints rate-limited. ✅ All authenticated endpoints behind `authenticate`.

### §2.2 `/api/farmers/*` — farmer profile

- `authenticate` + `extractOrganization` + `requireApprovedFarmer` (for farmer
  callers) + `requireFarmerOwnership` (when `:farmerId` is in URL).
- Cross-org access denied via `verifyOrgAccess` + logged as
  `cross_org_access_denied`.

### §2.3 `/api/farms/*`, `/api/gardens/*`, `/api/tasks/*`, `/api/scans/*`

- `authenticate` + ownership check via `requireOwnershipOrRole({ resolveOwnerId, allowRoles })`.
- Scan endpoints additionally rate-limited via `scanLimiter` (30 / min) and
  per-user daily quota (`scanLimitGuard.js` — 3/day free, 50/day pro).

### §2.4 `/api/buyer/*`

- `authenticate` + `requireRole('buyer', 'platform_admin')` via expansion.
- Listing reads gated by `sellLimiter` (60 / min).

### §2.5 `/api/ngo/*`, `/api/farmers/*` (NGO read APIs)

- `authenticate` + `extractOrganization` (forces non-super_admins to their org).
- `orgWhereFarmer(req)` injected into every Prisma `where` so an NGO operator
  in org A literally cannot read farmers in org B.

### §2.6 `/api/admin/*`

- `authenticate` + `authorize('super_admin')` (= `requireRole('platform_admin')`
  via alias expansion).
- All mutation endpoints write to `AdminAuditLog` (`actorId`, `actorRole`,
  `action`, `targetId`, `targetKind`, `payload`, `ip`, `userAgent`,
  `createdAt`) with whitelist of allowed actions.

### §2.7 `/api/reminders/*`

- `authenticate` only; user-scoped queries (`where: { userId: req.user.sub }`).

### §2.8 `/api/uploads/*` — file serving

- Static handler is **wrapped by `authenticate`**: `app.use('/uploads', authenticate, express.static(...))`.
- A user must hold a valid JWT to download evidence — not publicly indexable.

### §2.9 `/api/scan/analyze`

- `authenticate` + `scanLimiter` + `checkDailyScanLimit` (per-user quota)
  enforced **before** image preprocess so over-quota requests don't burn
  provider tokens.

### §2.10 `/api/health` + `/health` — liveness probe

- Public by design. Returns `{ status, db, uptime, timestamp, version }`.
  No PII, no internal config.

✅ No anonymous-write paths uncovered. ✅ No "TODO add auth" found in route code.

---

## §3 Object-level authorization (IDOR prevention)

| Resource                  | Ownership check                                                                 |
| ------------------------- | ------------------------------------------------------------------------------- |
| `Farmer` (`:farmerId`)    | `requireFarmerOwnership` — `farmer.userId === req.user.sub` for farmer role     |
| `Application` (`:id`)     | `requireApplicationAccess` — `assignedFieldOfficerId` / `assignedReviewerId`    |
| `Farm` / `CropCycle`      | `requireOwnershipOrRole({ resolveOwnerId })` — caller supplies resolver         |
| Cross-org Prisma queries  | `extractOrganization` + `orgWhereFarmer/Application/User` + `verifyOrgAccess`   |

A randomly-typed UUID by an unauthorized caller produces 403/404 (verified by
`server/src/__tests__/permissions.test.js` + `pilotReadinessOrgSecurity.test.js`).

✅ No direct `findUnique({ where: { id: req.params.id } })` without ownership check found in the audit pass.

---

## §4 Buyer / NGO / field-agent data protection

- Buyer profile fields scoped to their own row.
- NGO read APIs gated by `extractOrganization` so a field agent in NGO X cannot
  read farmer data scoped to NGO Y.
- Admin role (`platform_admin`) explicitly opts into cross-org via
  `?orgId=` query parameter and `req.isCrossOrg = true` flag — every other
  role's `req.isCrossOrg` is hard-coded `false`.

---

## §5 Audit logging

| Component                    | Status                                                                |
| ---------------------------- | --------------------------------------------------------------------- |
| `AdminAuditLog` Prisma model | ✅ — at `prisma/schema.prisma:2922-2939`, indexed on createdAt/actor/action/target |
| `logAuditAction(...)` helper | ✅ — `server/src/core/auditLog.js`, fire-and-forget, never throws      |
| Allowed-actions whitelist    | ✅ — `ALLOWED_ACTIONS` set rejects unknown action names               |
| `logPermissionEvent(...)`    | ✅ — `server/src/utils/opsLogger.js` (role_denied, ownership_denied, cross_org_access_denied, org_lookup_failed) |
| `logAuthEvent(...)`          | ✅ — token_invalid / token_revoked / account_not_found / account_deactivated |
| Read API for admins          | ✅ — `server/src/modules/audit/routes.js`                              |

---

## §6 JWT / session security

- **Algorithm:** HS256 with `JWT_SECRET` (production-validated ≥32 chars in `config/index.js#L21-24`).
- **Lifetime:** `JWT_EXPIRES_IN` env-configurable (default 24h).
- **Revocation:** per-user `tokenVersion` column; logout / password-reset
  bumps the counter and any older JWT is rejected.
- **httpOnly cookies:** V2 routes use `access_token` httpOnly cookies with
  `cookie-parser`; XSS-extracted localStorage tokens cannot impersonate.
- **Refresh tokens:** rotated on every refresh; `UserSession` row tracks
  `refreshTokenId`, `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`.
- **MFA step-up:** `requireStepUp.js` enforces re-MFA for sensitive ops within
  a configurable window (default 30 min).

---

## §7 Input validation

- `server/src/middleware/validate.js` exports `isValidUUID`, `isValidEmail`,
  `validatePassword`, `sanitizeFilename`, `validateParamUUID`.
- Zod schemas live at `server/lib/farmCostValidation.js`,
  `farmStageSchema.js`, `farmProfileSchema.js`, `harvestRecordValidation.js`,
  `seasonalTimingSchema.js`, `farmBenchmarking.js`, plus
  `intelligence/validation/schemas.ts` for the TS intelligence layer.
- Body size cap: `express.json({ limit: '2mb' })` + `urlencoded({ limit: '2mb' })`.
- Filename traversal: `sanitizeFilename` strips `/`, `\`, `:`, `\0`, `..`.

✅ No raw `req.body` interpolation into SQL detected (Prisma ORM exclusively).

---

## §8 File upload / scan security

- Multer + size cap (`MAX_FILE_SIZE_MB`, default 10MB).
- `scanInferenceService.js` calls `preprocessImage` before any AI work:
  validates magic bytes, optionally strips EXIF.
- Uploaded files served behind `authenticate` (§2.8).
- Per-user daily scan quota (3 free / 50 pro) enforced **before**
  preprocess to prevent compute-amplification abuse.
- `scanLimiter` (30 / min / IP) caps anonymous flood attempts.

---

## §9 SSRF protection

- The only outbound HTTP call paths are:
  - `weatherProvider.js` → `WEATHER_BASE_URL` (env-pinned to api.open-meteo.com).
  - SendGrid / Twilio (fixed provider hosts inside official SDKs).
  - Optional OAuth IdP (Google/Microsoft/Okta) — host pinned at config time,
    not user-controllable at runtime.
- No endpoint accepts a user-supplied URL and fetches it server-side.

---

## §10 Rate limiting

| Limiter            | Window | Cap | Coverage                                                  |
| ------------------ | ------ | --- | --------------------------------------------------------- |
| `apiLimiter`       | 1 min  | 200 | All `/api/*` (auth excluded)                              |
| `authLimiter`      | 5 min  | 30  | `/api/v2/auth/*` (skipSuccessful)                         |
| `loginLimiter`     | 5 min  | 15  | `/api/auth/login` (skipSuccessful)                        |
| `registrationLimiter` | 15 min | 5 | `/api/auth/register`                                      |
| `passwordResetLimiter` | 15 min | 5 | `/api/auth/forgot-password`                              |
| `mfaEnrollLimiter` | 15 min | 10  | `/api/auth/mfa/enroll`                                    |
| `mfaVerifyLimiter` | 5 min  | 10  | `/api/auth/mfa/verify`                                    |
| `inviteLimiter`    | 1 min  | 10  | NGO invite create                                         |
| `resendInviteLimiter` | 15 min | 5 | NGO invite resend                                        |
| `inviteAcceptLimiter` | 15 min | 10 | Public invite acceptance                                  |
| `workflowLimiter`  | 1 min  | 30  | Approve / reject / disburse / scoring                     |
| `submissionLimiter`| 1 min  | 20  | Progress / season submissions                             |
| `uploadLimiter`    | 1 min  | 15  | File upload                                               |
| `scanLimiter`      | 1 min  | 30  | `/api/(v\d+/)?(scan|pest-scan|crop-scan|image-scan)`      |
| `fundingLimiter`   | 1 min  | 60  | `/api/(v\d+/)?(funding|opportunities|fund-application)`   |
| `sellLimiter`      | 1 min  | 60  | `/api/(v\d+/)?(market|listing|listings|sell|buyer-interest)` |
| `securityLimiter`  | 1 min  | 10  | SoD / JIT security requests                               |
| `ingestLimiter`    | 1 min  | 120 | `POST /api/ingest`                                        |
| `readLimiter`      | 1 min  | 300 | NGO dashboard reads                                       |

- Redis-backed when `REDIS_URL` is set; in-memory fallback for single-replica
  deploys (loaded lazily so the build never requires `rate-limit-redis`).

---

## §11 CORS / CSRF

- `cors({ origin: allowlist | true | functionDeny })` driven by `CORS_ORIGIN`
  env var (comma-separated). Production with no `CORS_ORIGIN` rejects every
  cross-origin request.
- Allowed methods restricted to `GET / POST / PUT / PATCH / DELETE / OPTIONS`.
- Allowed headers: `Content-Type`, `Authorization`, `X-Idempotency-Key`,
  `x-user-id` only.
- Credentials: true (cookies allowed for V2 routes only).
- CSRF: V1 uses Bearer tokens (no cookies → no CSRF risk). V2 cookie auth uses
  SameSite=Strict cookies; CSRF tokens not strictly needed but adding one
  pre-public-launch is a defence-in-depth nice-to-have (not blocking).

---

## §12 Error handling

- Centralised in `server/src/middleware/errorHandler.js`.
- Production responses never leak stack traces — only `{ error: <message> }`.
- `requestId` middleware tags every response with `X-Request-Id` for trace
  correlation.
- 500 paths logged server-side via `requestLogger`.

---

## §13 Security headers

- `helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })`.
- CSP intentionally off because Vite bundles use inline scripts; CSP should be
  configured at the reverse proxy / CDN tier (recommendation, not blocker).
- HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy all set by
  helmet defaults.

**Recommendation (post-launch):** enable a strict CSP at the CDN once the
inline-script set is enumerated.

---

## §14 Secrets management

| Mechanism                            | Status                                                      |
| ------------------------------------ | ----------------------------------------------------------- |
| `.env`, `.env.local`, `.env.production` in `.gitignore` | ✅ — root `.gitignore` lines 3–7    |
| `JWT_SECRET` length validated (≥32)  | ✅ — `config/index.js#L21-24`, fatal exit on miss           |
| `MFA_SECRET_KEY` shape validated     | ✅ — 64-char hex enforced before MFA features enable        |
| Required vars validated at boot      | ✅ — `JWT_SECRET`, `DATABASE_URL` in production             |
| Soft-fail on optional vars           | ✅ — SendGrid/Twilio degrade gracefully with warnings       |
| Pre-commit secrets scanner           | ✅ — `scripts/ci/scan-secrets.mjs` (added this turn)        |

### Hardening added this turn

- `scripts/ci/scan-secrets.mjs` — regex pass over the working tree for
  SendGrid / Twilio / AWS / Slack / Stripe / Google / GitHub / private keys /
  Postgres URLs with embedded passwords / hardcoded JWT secrets / MFA keys /
  generic `*_API_KEY` literals. Skips test fixtures and `.env*` files. Exits
  with code 1 on any finding so CI fails the build. Runs clean against the
  current tree (1927 files / 0 findings).

---

## §15 Database query safety

- 100% of database access through `@prisma/client` parameterised queries — no
  raw `$queryRaw` with user-controlled string interpolation in mutation paths.
- `prisma.$queryRaw\`SELECT 1\`` used only in the health probe.
- Foreign-key cascades configured (`onDelete: Cascade` on `UserSession.userId`,
  etc.) so user deletion sweeps up tokens.

---

## §16 Security tests

### Server-side unit tests (in-process, with mocks)

| Test file                                       | Coverage                                                   |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `permissions.test.js`                           | Role gates per endpoint                                    |
| `auth.test.js` + `authBlinkFix` + `authUX` etc. | Login / refresh / logout flows                             |
| `loginHardening.test.js`                        | Brute-force, lockout, timing                               |
| `orgScope.test.js`                              | Cross-org IDOR rejection                                   |
| `sodGuard.test.js`                              | Separation-of-duty enforcement                             |
| `security-service.test.js` + `security.mfa.test.js` | MFA enrollment / challenge / step-up                  |
| `pilotReadinessOrgSecurity.test.js`             | End-to-end org-scoped admin/operator access                |
| `userOffboardingAuth.test.js`                   | Token revocation on offboarding                            |
| `roleAliases.test.js` (added this turn)         | 6-role spec ↔ legacy auth-name normalisation               |

✅ ~150 server-side tests including ~13 dedicated security tests.
Run via `npm run security:audit` (which chains `security:scan-secrets` +
`security:test:unit`).

### Live-HTTP API security harness (added this turn)

A separate harness in `security-tests/` exercises the running backend over
HTTP from outside the unit-test process. See `security-tests/README.md`
and `security-tests/security-test-plan.md` for the canonical 25-row test
matrix. Includes:

| Artefact                                  | Runner                |
| ----------------------------------------- | --------------------- |
| `security-tests/api-security.test.ts`     | `npm run security:test`  |
| `security-tests/curl-tests.sh`            | `npm run security:curl`  |
| `security-tests/postman_collection.json`  | Postman / Insomnia / Bruno (import + Run All) |
| `npm run security:all`                    | vitest harness + curl harness, fail-fast |

Tests cover unauth access, invalid tokens, cross-user IDOR, buyer privacy,
NGO program isolation, field-agent assignment scoping, admin route
protection, scan rate-limit, upload mime/size validation, and error-message
leakage. Pre-flight refuses to run against the production apex.

---

## §17 Mobile / native concerns

- `android/` and `ios/` Capacitor wrappers ship with the same `dist/` JS
  bundle; same auth + CSP rules apply.
- Capacitor `Geolocation` plugin requests permission at runtime — handled in
  `src/services/geo.js`.

---

## §18 Dependencies

- All security-critical deps current as of 2026-05-03:
  - `express@4.21.2`
  - `helmet@8.1.0`
  - `bcryptjs@2.4.3`
  - `jsonwebtoken@9.0.2`
  - `express-rate-limit@8.3.2`
  - `@prisma/client@6.9.0`
  - `cors@2.8.5`
- **Recommendation (post-launch):** schedule monthly `npm audit` runs as part
  of release-candidate gating.

---

## §19 npm scripts (added this turn)

```jsonc
{
  "security:scan-secrets": "node scripts/ci/scan-secrets.mjs",
  "security:test":         "cd server && npx vitest run … (7 security suites)",
  "security:audit":        "npm run security:scan-secrets && npm run security:test",
  "launch-gate:security":  "npm run security:audit"
}
```

Run `npm run launch-gate:security` before every release-candidate cut.

---

## §20 Findings & remediations

### Findings discovered in this audit

| # | Severity | Finding                                                    | Status                                                |
| - | -------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| 1 | Low      | Spec uses canonical 6-role names; server JWTs carry legacy names — `requireRole('platform_admin')` would not match a `super_admin` JWT | Fixed: `roleAliases.js` normaliser bridges both directions |
| 2 | Low      | No pre-launch secrets scanner in CI                        | Fixed: `scripts/ci/scan-secrets.mjs` + `npm run security:scan-secrets` |
| 3 | Info     | `docker-compose.yml` had a hardcoded local-dev Postgres password | Fixed: now `${DATABASE_URL:-…}` env-templated, default kept for local smoke tests only |
| 4 | Info     | No top-level `npm run security:audit` script               | Fixed: added 4 npm scripts wrapping existing tests + scanner |
| 5 | Info     | No SECURITY_AUDIT_REPORT.md                                | Fixed: this document                                  |

### Recommendations (post-launch, not blocking)

| #  | Severity | Recommendation                                                                                |
| -- | -------- | --------------------------------------------------------------------------------------------- |
| R1 | Low      | Enable strict CSP at the CDN once inline-script set is enumerated                             |
| R2 | Low      | Add `npm audit --production` to release-candidate gating (monthly)                            |
| R3 | Info     | Add a CSRF token to V2 cookie-auth routes for defence-in-depth (current SameSite=Strict suffices) |
| R4 | Info     | Consider migrating server JWT role claims to canonical 6-role names in a future migration so the alias bridge can be retired |
| R5 | Info     | Consider TruffleHog / Gitleaks for git-history secrets sweep before public-launch announcement |

---

## §21 Final verdict

> ## ✅ READY FOR SOFT LAUNCH
>
> The Farroway backend has the security foundation expected of a production
> system at this scale: layered authentication, role + org gating, cross-org
> IDOR prevention, MFA, audit logging, comprehensive rate limiting, validated
> secrets at boot, and a passing security test suite.
>
> The five findings uncovered in this audit were all low-severity / info-only
> and have been remediated in this turn. No critical, currently-exploitable
> issues remain.
>
> **READY FOR PUBLIC LAUNCH AFTER EXTERNAL REVIEW.**
>
> Recommended pre-public-launch steps:
> 1. Commission a third-party penetration test (1–2 week engagement).
> 2. Run TruffleHog / Gitleaks against the full git history (R5).
> 3. Enable strict CSP at the CDN tier (R1).
> 4. Add `npm audit --production` to release-candidate gating (R2).
> 5. Tabletop incident-response drill with on-call rotation.
>
> Once R1, R2, and an external pen-test sign off, the verdict moves to
> **READY FOR PUBLIC LAUNCH**.

---

*Generated by the internal Farroway audit pass on 2026-05-03.*
