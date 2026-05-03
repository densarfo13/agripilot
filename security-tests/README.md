# Farroway — Backend Security Test Harness

Automated tests that simulate common API attacks against a running Farroway
backend. Run before every release-candidate cut and as the last gate before
public launch.

These tests live **outside** `server/src/__tests__/` because they exercise
the API over HTTP against a live server (not the in-process unit-test
harness). They complement, not replace, the unit suite — see
`SECURITY_AUDIT_REPORT.md` §16 for the unit-level coverage.

---

## What's in this directory

| File                        | Purpose                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `README.md`                 | This file — quick-start                                                 |
| `security-test-plan.md`     | Full test matrix + severity table (Critical / High / Medium)            |
| `curl-tests.sh`             | 15-test bash harness for ops smoke-tests                                |
| `api-security.test.ts`      | 50+ vitest cases exercising the same surface from TypeScript            |
| `postman_collection.json`   | Postman v2.1 collection (importable into Postman / Insomnia / Bruno)    |

---

## Test users you must create

The harness needs eight bearer tokens (or session cookies) for distinct test
accounts. Create them in your **staging** environment (NEVER production) and
export them as env vars before running:

```bash
export USER_A_FARMER_TOKEN="eyJhbGciOi…"   # owns USER_A_FARM_ID + USER_A_SCAN_ID
export USER_B_FARMER_TOKEN="eyJhbGciOi…"   # owns USER_B_FARM_ID + USER_B_SCAN_ID
export BUYER_TOKEN="eyJhbGciOi…"           # buyer role
export NGO_A_TOKEN="eyJhbGciOi…"           # ngo_admin in PROGRAM_A_ID
export NGO_B_TOKEN="eyJhbGciOi…"           # ngo_admin in PROGRAM_B_ID
export FIELD_AGENT_TOKEN="eyJhbGciOi…"     # field_agent assigned to ONE farmer in PROGRAM_A
export PLATFORM_ADMIN_TOKEN="eyJhbGciOi…"  # super_admin / platform_admin
export INVALID_TOKEN="not-a-real-jwt"
```

And eight resource IDs:

```bash
export USER_A_FARM_ID="…"
export USER_B_FARM_ID="…"
export USER_A_SCAN_ID="…"
export USER_B_SCAN_ID="…"
export PROGRAM_A_ID="…"
export PROGRAM_B_ID="…"
export PRIVATE_LISTING_ID="…"      # listing visible only to its owning farmer
export PUBLIC_LISTING_ID="…"       # listing flagged public for buyers
export UNASSIGNED_FARMER_ID="…"    # a farmer NOT assigned to FIELD_AGENT_TOKEN
```

Plus the API base URL:

```bash
export API_BASE_URL="https://staging.farroway.app"   # or http://localhost:4000
```

### How to mint test tokens

Pick one:

1. **Quickest** — `node server/scripts/init-admin.mjs`-style helper, then
   `POST /api/auth/login` with each test account's credentials and pluck the
   JWT from the response. Stash them in a local `.env.security-tests` file
   (gitignored — `.env*` is already in `.gitignore`).
2. **CI** — store tokens as masked CI secrets and inject them into the runner
   env at job start.
3. **Long-lived** — issue 24-hour tokens via the auth service for the
   security-test bot user; rotate after every test run.

> ⚠ **Never reuse a production user's token.** If a test mutates state
> (e.g. an upload that hits the file system), you want it isolated. The
> staging cluster should have its own database.

---

## How to run

### 1. Bash (curl) harness — fastest smoke test

```bash
# Load your env vars first, then:
bash security-tests/curl-tests.sh
# or via npm:
npm run security:curl
```

Output: 15 numbered tests, colourised PASS/FAIL, exit code 0 on full pass.

### 2. Vitest (TypeScript) harness — comprehensive

```bash
npm run security:test
```

Runs `vitest` against `security-tests/api-security.test.ts`. Tests for which
the required env var is unset will be **skipped** with a clear message rather
than failing — so you can run a partial suite while you finish onboarding the
test users.

### 3. Postman / Insomnia / Bruno

Import `security-tests/postman_collection.json` into your client of choice.
Create an environment with the same variable names as above and run the
collection (Runner → Run all). Each request has built-in tests for status
code + sensitive-leak patterns.

### 4. Everything at once

```bash
npm run security:all
```

Runs vitest harness + curl harness back-to-back. Fails fast on the first
non-zero exit.

---

## What the tests cover

| Category                           | curl | vitest | Postman |
| ---------------------------------- | :--: | :----: | :-----: |
| Unauthenticated access (401)       |  ✓   |   ✓    |    ✓    |
| Invalid-token rejection            |  ✓   |   ✓    |    ✓    |
| Cross-user IDOR (farmer ↔ farmer)  |  ✓   |   ✓    |    ✓    |
| Buyer privacy (private scan/listing) | ✓ |   ✓    |    ✓    |
| NGO cross-program leak             |  ✓   |   ✓    |    ✓    |
| Field-agent assignment scoping     |  ✓   |   ✓    |    ✓    |
| Admin-route protection             |  ✓   |   ✓    |    ✓    |
| Scan rate-limit enforcement        |  ✓   |   ✓    |    ✓    |
| Upload validation (mime / size)    |  ✓   |   ✓    |    ✓    |
| Error-message leakage              |  ✓   |   ✓    |    ✓    |

---

## Critical blockers

If **any** of these fails, **do not ship**:

1. Cross-user IDOR (test 3, 4)
2. Buyer reading a private scan or private listing (test 5, 6)
3. NGO A reading Program B (test 8)
4. Farmer reaching `/api/admin/*` (test 10)
5. Error responses leaking stack traces, Prisma error messages, or
   `JWT` / `DATABASE_URL` / `AUTH_SECRET` substrings (test 15)

The medium-severity findings (verbose error messages on validation failures,
weak CORS headers, missing security headers) are remediation-required but not
hard blockers — see `security-test-plan.md` for the severity matrix.

---

## Strict-rule audit

- **Read-only tests by default.** Tests that mutate state are clearly
  marked `[mutates]` and are gated behind `RUN_MUTATING_TESTS=true`.
- **No real production data.** Run against staging; the test plan refuses
  to run if `API_BASE_URL` resolves to a `farroway.app` apex (see plan §0).
- **No baked-in credentials.** Every token comes from an env var. Missing
  tokens cause tests to **skip**, not pass — silent skips would mask gaps.
- **Idempotent.** Running the suite twice produces the same verdict.
- **Fail-loud.** Any unexpected status code or sensitive-leak pattern
  surfaces a non-zero exit code so CI fails the gate.

---

## Updating the harness

Adding a new test? Update **all four** artefacts so they stay in sync:

1. Add the case to `curl-tests.sh` (a new `run_test` invocation).
2. Add the matching `it(...)` to `api-security.test.ts`.
3. Add a request to `postman_collection.json` under the right folder.
4. Add a row to `security-test-plan.md`'s test matrix.

The single source of truth is `security-test-plan.md` — every other file is
a runnable view of that plan.
