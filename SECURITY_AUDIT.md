# Security Audit (RC1)

OWASP Top 10 + platform controls. Status: **MITIGATED** (control present in code) ·
**PARTIAL** (present, needs verification) · **UNVERIFIED** (no independent test yet).
Honest: code-side controls are in place; the gaps are *verification*, not known holes.

## OWASP Top 10
| # | Risk | Status | Evidence |
|---|---|---|---|
| A01 | Broken access control | **PARTIAL** | protectedRouter + RBAC (farmer/NGO/buyer/admin); tenant isolation gate. Live scale-test pending. |
| A02 | Cryptographic failures | **PARTIAL** | HTTPS (Railway); JWT signed; secrets in env. Key-rotation policy not documented. |
| A03 | Injection (SQL/XSS) | **MITIGATED** | Prisma parameterized queries (no raw SQL); React escapes by default; no `dangerouslySetInnerHTML` on user data. |
| A04 | Insecure design | **PARTIAL** | honesty invariants (no fabrication) + safety gates; threat model not formally documented. |
| A05 | Security misconfiguration | **PARTIAL** | provider keys server-side only (never in browser); CORS/headers set. Config review pending. |
| A06 | Vulnerable components | **UNVERIFIED** | **no dependency scanning in CI** (npm audit / Dependabot not gating). |
| A07 | Auth failures | **PARTIAL** | JWT + session cache; login/route-guard health envelopes. Brute-force/lockout policy not verified. |
| A08 | Integrity failures | **MITIGATED** | frozen-core hashing on constitution; Prisma migrations clean-gated. |
| A09 | Logging/monitoring failures | **PARTIAL** | audit logging + secrets-never-logged (tested); scanObservability. Live SIEM/alerting pending real traffic. |
| A10 | SSRF | **MITIGATED** | provider calls are fixed server-side endpoints; no user-supplied URLs fetched. |

## Platform controls
- **JWT / session** — signed tokens; session cache key namespaced. PARTIAL (expiry/refresh verified in code; device pending).
- **CSRF** — API is token-auth (not cookie-session for mutations) → CSRF surface limited. PARTIAL.
- **Secrets / env vars** — never logged (unit-tested); provider keys server-only. **MITIGATED.**
- **File upload (scan image)** — sent to server → provider; not persisted as executable; image bytes never logged. PARTIAL (size/type limits — verify).
- **Camera / location permissions** — requested explicitly; coarse coords only (~1km); denied-paths handled. **MITIGATED.**
- **RBAC** — role-scoped routes + tenant isolation. PARTIAL (live cross-tenant test pending).
- **Audit logging** — canonical events attested by AuditRuntime. PARTIAL.

## Blockers (security)
1. **No independent penetration test.** — blocks unrestricted public exposure (not the pilot).
2. **No dependency vulnerability scanning in CI** (A06).
3. Key-rotation + formal threat model undocumented.

**Verdict:** controls are present and the high-risk injection/SSRF/secrets classes are mitigated.
The blockers are **verification gaps** (pen-test, dep-scan), which cap public launch — not a
controlled pilot. **Security: PILOT-acceptable, public-launch PENDING.**
