# Public API + Partner Ecosystem Report

## Exists today (verified in server/src/app.js)
- **Versioned mounts:** `/api/v1/farms`, `/api/v1/weather` (+ nested farm-weather/insights routes).
- **Enterprise API:** keyed via `ENTERPRISE_API_KEYS`; **fails closed** — returns PUBLIC-only data
  + `503` until keys are configured; never leaks tenant data.
- **Security controls live:** RBAC, tenant isolation, rate limiting (`scanUserLimiter` et al.),
  audit logging, secrets never logged, request auth on every route.
- **Consent-before-share** now has its engine (`check:finance-honesty`): partner-bound farmer data
  is consent-gated at the logic layer.

## Deferred deliberately (zero partners = speculative infrastructure)
Partner registry, scoped per-partner API keys, webhook subscriptions + signing + delivery tables,
OpenAPI generation, sandbox mode, developer portal. Building a webhook delivery system with no
subscriber and a partner registry with no partner produces untested-in-anger code that rots. The
API_BLUEPRINT.md forward plan stands: **build each piece with its first real consumer** — the seams
(versioned mounts, keyed enterprise surface, event catalog for webhook payloads, consent engine)
are already in place, so each addition is a bounded feature, not a rewrite.

## First-partner playbook (when one signs)
1. Row in a `partner_registry` table + scoped key (extends `ENTERPRISE_API_KEYS` pattern).
2. Expose the agreed slice under `/api/v1/*` behind consent + tenant checks.
3. Webhook subscription over the existing domain events, HMAC-signed.
4. OpenAPI spec generated from the route validation schemas at that point.
