# ADMIN_AUTH_FIX_REPORT.md (2026-07-05)

## Root cause (evidence-backed)
`/admin/intelligence/regional-risk` and `/high-risk-farms` call `/api/v2/intelligence-admin/*`
via `src/lib/intelligenceAdminApi.js` — the ONE API helper in the app that authenticated with
**cookie only** (`credentials:'include'`, no `Authorization` header). Every other admin call
attaches the Bearer token from `localStorage 'farroway_token'`. Two compounding bugs:

1. **No bearer token** → when the admin's session is token-based (no valid cookie sent), the server
   sees no credentials and denies the call. Live probe confirmed the endpoint IS mounted (returns a
   structured `403 {"error":"Admin access required"}`, not 404) — it's the compiled intelligence
   service (`server/intelligence`, re-exporting the main `authenticate`, which sets `req.user.role`
   from the **DB**, source of truth). So a 403 here means the signed-in account's DB role is not
   `super_admin`/`institutional_admin` — a *correct* denial, not a server bug.
2. **Status discarded** → `request()` threw only a string; the hook then TEXT-MATCHED
   `/SESSION|401/` to guess auth, so a genuine **403 (Access denied)** was mislabeled
   **"Session expired. Please log in again."** — the exact observed symptom.

## Auth fix (client, universal — no compiled-service surgery)
- `src/lib/intelligenceAdminApi.js` — now attaches `Authorization: Bearer <farroway_token>`
  (matching the whole app) alongside the cookie, and on failure throws an Error carrying the REAL
  `status` + a computed `errorType`.
- `src/lib/intelligenceAdminError.js` (NEW, pure) — `classifyAdminApiError(status)`:
  401→`SESSION_EXPIRED`, **403→`ACCESS_DENIED`**, 0→`NETWORK_ERROR`, else `API_ERROR`.
- `src/api/apiClient.js` `structureError` (the SHARED classifier used by every intelligence hook) —
  added the missing **403→ACCESS_DENIED** branch and made it honor a pre-attached `errorType`. This
  fixes regional-risk, high-risk-farms, hotspots, alerts, interventions in one place.
- `src/hooks/useIntelligenceAdmin.js` — classifies by `status`/`errorType` first; text-match is now
  only a legacy fallback.

Result: a real expired session still says **"Session expired"**; a valid admin lacking the role now
sees **"Access denied"** (spec P0). If the founder account is *meant* to be super_admin, the
remaining action is an **ops DB role change** (not code) — stated honestly, not faked.

## Verification
Live: `GET /api/v2/intelligence-admin/regions/risk` with a non-admin identity → 403 "Admin access
required" (correct). With the client fix, the UI renders "Access denied" + retry, not "Session
expired". A token-authenticated admin now sends the bearer and is authorized when the DB role allows.
