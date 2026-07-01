# Security Baseline

Summary of the platform security posture. Full OWASP Top 10 detail + status is in
**SECURITY_AUDIT.md** — this is the one-page baseline; that is the audit. Not duplicated here.

## Baseline (in place)
- **RBAC** — role-scoped routes (farmer/gardener/buyer/NGO/gov/admin) + `protectedRouter`.
- **Tenant isolation** — enterprise tenants cannot see each other's data (gate + runtime).
- **Secrets management** — provider keys server-side only, **never logged**, never in the browser
  (unit-tested); env-var based.
- **Transport** — HTTPS (Railway); JWT signed; session cache namespaced.
- **Injection / SSRF** — Prisma parameterized queries; no user-supplied fetch URLs; React escaping.
- **Audit logging** — canonical events attested (AuditRuntime).
- **Rate limiting + security headers** — present on the API.
- **Privacy** — coarse coordinates only (~1km); image bytes never logged.

## Zero-Trust posture
Every request is authenticated + role-checked at the route; the enterprise API returns PUBLIC-only
data + `503` until keys are configured (fails closed, never leaks).

## Blockers (verification, not known holes)
- **No independent penetration test.**
- **No dependency vulnerability scanning in CI** (OWASP A06).
- Key-rotation policy + formal threat model undocumented.

These cap **public launch**, not a controlled pilot. See SECURITY_AUDIT.md for the item-by-item
status and FINAL_GO_LIVE_CHECKLIST.md for the decision.
