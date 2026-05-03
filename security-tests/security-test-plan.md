# Farroway — Security Test Plan

Single source of truth for the API security harness. Every test in
`curl-tests.sh`, `api-security.test.ts`, and `postman_collection.json`
maps to exactly one row in this table.

---

## §0 Pre-flight

The harness refuses to run when:

- `API_BASE_URL` is empty.
- `API_BASE_URL` matches `https://farroway.app` (the production apex —
  the test plan never targets prod). Use `staging.farroway.app` or
  `localhost:4000` instead.
- `PLATFORM_ADMIN_TOKEN` looks like a production-issued long-lived
  admin JWT (sanity check — fail closed).

---

## §1 Severity definitions

| Severity   | Definition                                                        | Action on failure                      |
| ---------- | ----------------------------------------------------------------- | -------------------------------------- |
| 🔴 Critical | Auth bypass · admin bypass · cross-user data leak · buyer privacy leak · NGO cross-program leak | **Block release.** Fix before merge.   |
| 🟠 High    | Unrestricted scan abuse · upload bypass · secrets exposed in errors | **Block release.** Fix before merge.   |
| 🟡 Medium  | Verbose errors · weak CORS · missing security headers              | Fix before public launch (post-pilot). |

---

## §2 Test matrix

| #  | Test                                                | Role                  | Endpoint                                    | Method | Expected         | Severity if fails | Result |
| -- | --------------------------------------------------- | --------------------- | ------------------------------------------- | :----: | ---------------- | ----------------- | ------ |
| 1  | Unauthenticated request rejected                    | none                  | `/api/farms`                                | GET    | `401`            | 🔴 Critical        | ☐      |
| 2  | Invalid bearer token rejected                       | invalid               | `/api/farms`                                | GET    | `401`            | 🔴 Critical        | ☐      |
| 3  | Farmer A can NOT read Farmer B's farm (IDOR)        | `USER_A_FARMER_TOKEN` | `/api/farms/$USER_B_FARM_ID`                | GET    | `403` or `404`   | 🔴 Critical        | ☐      |
| 4  | Farmer A can NOT read Farmer B's scan (IDOR)        | `USER_A_FARMER_TOKEN` | `/api/scans/$USER_B_SCAN_ID`                | GET    | `403` or `404`   | 🔴 Critical        | ☐      |
| 5  | Buyer can NOT read a private farmer scan            | `BUYER_TOKEN`         | `/api/scans/$USER_A_SCAN_ID`                | GET    | `403` or `404`   | 🔴 Critical        | ☐      |
| 6  | Buyer can NOT read a private listing                | `BUYER_TOKEN`         | `/api/buyer/listings/$PRIVATE_LISTING_ID`   | GET    | `403` or `404`   | 🔴 Critical        | ☐      |
| 7  | Buyer CAN read a public listing                     | `BUYER_TOKEN`         | `/api/buyer/listings/$PUBLIC_LISTING_ID`    | GET    | `200`            | 🟡 Medium          | ☐      |
| 8  | NGO A can NOT read Program B                        | `NGO_A_TOKEN`         | `/api/ngo/programs/$PROGRAM_B_ID`           | GET    | `403` or `404`   | 🔴 Critical        | ☐      |
| 9  | Field agent can NOT read unassigned farmer          | `FIELD_AGENT_TOKEN`   | `/api/ngo/farmers/$UNASSIGNED_FARMER_ID`    | GET    | `403` or `404`   | 🔴 Critical        | ☐      |
| 10 | Farmer can NOT reach `/api/admin/*`                 | `USER_A_FARMER_TOKEN` | `/api/admin/users`                          | GET    | `403`            | 🔴 Critical        | ☐      |
| 11 | Platform admin CAN reach `/api/admin/*`             | `PLATFORM_ADMIN_TOKEN`| `/api/admin/users`                          | GET    | `200`            | 🟡 Medium          | ☐      |
| 12 | Scan rate-limit kicks in (HTTP 429)                 | `USER_A_FARMER_TOKEN` | `/api/scan/analyze` ×35 in 60s              | POST   | eventually `429` | 🟠 High            | ☐      |
| 13 | Upload rejects non-image MIME (`.txt` / fake JPG)   | `USER_A_FARMER_TOKEN` | `/api/scan/analyze`                         | POST   | `400`            | 🟠 High            | ☐      |
| 14 | Upload rejects oversized file (>10 MB default)      | `USER_A_FARMER_TOKEN` | `/api/scan/analyze`                         | POST   | `400` or `413`   | 🟠 High            | ☐      |
| 15 | Error response does NOT leak stack / Prisma / JWT   | any                   | `/api/farms/invalid-id`                     | GET    | `400/404`, no leak | 🔴 Critical      | ☐      |
| 16 | Error response on missing body does NOT leak schema | `USER_A_FARMER_TOKEN` | `/api/scan/analyze` (empty body)            | POST   | `400`, no leak   | 🟠 High            | ☐      |
| 17 | Buyer can NOT call farmer-only sell endpoint        | `BUYER_TOKEN`         | `/api/sell/listings`                        | POST   | `403`            | 🔴 Critical        | ☐      |
| 18 | NGO A field agent can NOT trigger admin actions     | `FIELD_AGENT_TOKEN`   | `/api/admin/users`                          | GET    | `403`            | 🔴 Critical        | ☐      |
| 19 | Buyer can NOT read another farmer's farm directly   | `BUYER_TOKEN`         | `/api/farms/$USER_A_FARM_ID`                | GET    | `403` or `404`   | 🔴 Critical        | ☐      |
| 20 | NGO B can NOT read NGO A's farmer roster            | `NGO_B_TOKEN`         | `/api/ngo/farmers?programId=$PROGRAM_A_ID`  | GET    | `403` or empty `200` | 🔴 Critical    | ☐      |
| 21 | Health endpoint is publicly reachable               | none                  | `/api/health`                               | GET    | `200` or `503`   | 🟡 Medium          | ☐      |
| 22 | Public marketplace listing reachable without auth   | none                  | `/api/marketplace`                          | GET    | `200`            | 🟡 Medium          | ☐      |
| 23 | Generic OPTIONS preflight succeeds                  | none                  | `/api/farms`                                | OPTIONS| `204` or `200`   | 🟡 Medium          | ☐      |
| 24 | Sensitive-leak scan: response never contains `JWT_SECRET` substring | any   | every endpoint                              | any    | not present      | 🟠 High            | ☐      |
| 25 | Sensitive-leak scan: response never contains absolute file paths    | any   | every endpoint                              | any    | not present      | 🟠 High            | ☐      |

---

## §3 Sensitive-leak patterns

The harness scans every error/non-200 response body for these substrings.
Any match is a 🟠 High finding.

| Pattern (case-insensitive) | Why                                                |
| -------------------------- | -------------------------------------------------- |
| `at Object.`               | Node.js stack frame                                |
| `at /` / `at C:\\`         | Absolute file path in stack trace                  |
| `Prisma`                   | ORM internals — schema info / query shape          |
| `PrismaClientKnownRequestError` | Prisma error class name                       |
| `SQL` / `SQLSTATE`         | Raw SQL surfaced to client                         |
| `DATABASE_URL`             | Connection string env var                          |
| `AUTH_SECRET` / `JWT_SECRET` | Signing key env vars                              |
| `node_modules`             | Internal path leaked                               |
| `MFA_SECRET_KEY`           | TOTP encryption key                                |
| `SENDGRID_API_KEY`         | Provider key                                       |
| `TWILIO_AUTH_TOKEN`        | Provider key                                       |
| `BEGIN PRIVATE KEY`        | Inline private key                                 |
| `xox[abprs]-`              | Slack token prefix                                 |
| `AKIA[0-9A-Z]{16}`         | AWS access key                                     |
| `eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.` | A real-shape JWT in a body that shouldn't carry one |

---

## §4 Test execution log

Update this section on every run. Date format: `YYYY-MM-DD HH:MM TZ`.

| Date / Run        | Env       | # Tests | # Critical fail | # High fail | # Medium fail | Notes                |
| ----------------- | --------- | ------- | --------------- | ----------- | ------------- | -------------------- |
| _(first run TBD)_ |           |         |                 |             |               |                      |

---

## §5 Verdict criteria

- **SECURITY TEST HARNESS READY** when:
  - All 25 tests are wired in `curl-tests.sh` + `api-security.test.ts` + `postman_collection.json`.
  - The harness can run end-to-end against `localhost:4000` with synthetic tokens.
  - Sensitive-leak scan triggers on a deliberately-broken endpoint in dev.

- **NEED FIXES** when:
  - Any test in §2 is missing from one of the runnable artefacts.
  - The pre-flight gate (§0) doesn't block runs against the production apex.
  - The leak-pattern set (§3) is missing any item from the spec.

This document is updated every time a test is added or moved between
severity bands.
