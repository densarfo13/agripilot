# Security Constitution

Binding law for security posture. (No prior standalone owner — this is the canonical security doc.)

## Principles
Zero Trust · Least privilege · Encryption · Audit · Rate limiting · Secure secrets · Dependency scanning.

## Enforced / present today
- **Authn/authz** — `middleware/protectedRouter.js`; admin/internal routes are role-gated; auth
  federation routes guarded (`check:federation-security`).
- **Least privilege + isolation** — tenant isolation (`check:enterprise-isolation`,
  `check:enterprise-runtime-ownership`); bulk-onboarding security (`check:bulk-onboarding-security`).
- **Audit** — `check:audit-logging` attests canonical event coverage; audit log on state changes.
- **Rate limiting** — per-user scan limiter (`scanUserLimiter`, 60/min) + route limiters.
- **Secrets** — provider/API keys are server-side env secrets; never logged, never reach the
  browser; image bytes never stored; coarse coords only in traces (redaction tests).
- **Idempotency middleware** — `X-Idempotency-Key` guards mutations against replay.

## Field-pending (honest)
- **Independent penetration test / external audit** — not performed; required before public launch
  (PRODUCTION_CERTIFICATION §9 Security = PARTIAL).
- **Automated dependency scanning** in CI — recommended next step (e.g. `npm audit` gate / Dependabot).
- Auth flows under real load — verify during internal test.

Security blocks external (25-user) exposure until the pen-test + load verification are done.
