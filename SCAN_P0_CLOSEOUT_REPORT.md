# SCAN_P0_CLOSEOUT_REPORT.md — Track A evidence (2026-07-05)

Scope: prove Scan stability per the 10 required evidence items. Two server-side P0/P1 defects were
fixed this pass (identity aliasing + API-host redirect); the remaining open item is device-gated.

## The 10 evidence items — honest status

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Production scan reaches result screen | ⏳ **DEVICE-GATED** | Server path proven (live probe: analyze 200, conf 25, 3 candidates). Result-tree renders clean vs the REAL envelope (jsdom + effects, 5/5 components). The failing device has not yet re-tested on the fixed bundle. **This is the one item only the operator can close.** |
| 2 | /api/scan/analyze returns 200 | ✅ | Live production probes 200 (multiple, incl. scanId `scan_mr74d6wq`); plant.id upstream 200. |
| 3 | Result renders without React crash | 🟡 | All result components render clean against the real fixed-deploy envelope; rules-of-hooks = 0. Final confirmation rides item 1. |
| 4 | Journal/Activity persistence works | ✅ **FIXED THIS PASS (W2)** | Root cause: tokens sign the user id as `sub` only; `req.user.id` was `undefined` on every request → `/api/scan/history` always 401 (`unauthorized`, 24 bytes — matches production logs) and scan rows persisted with NULL userId (owner's history empty). Fix: `id: payload.sub` aliased on BOTH auth paths in `server/src/middleware/auth.js` + 2 regression tests (30/30 auth tests green). Pre-fix rows with null userId remain orphaned (backfill = separate decision). |
| 5 | /admin/scan-debug exports client diagnostics | ✅ | Shipped + verified in the live bundle (deploy `15b2dd68`): Export Diagnostic Report on both scan fallbacks; exceptions persisted to localStorage with message/stack/componentStack/correlationId/scanId/phase; `window.exportFarrowayDiagnostics()`. |
| 6 | /api/admin/scan/last-trace matches correlationId | 🟡 | Endpoint exists and is `admin_only` (email-allowlist — my service-token probe correctly got 403, which itself proves the gate). Correlation match must be checked from the founder's admin session. |
| 7 | No service worker stale bundle | ✅ | SW `OFFLINE_SHELL_V1`: HTML network-first, hashed assets cache-first (immutable), skipWaiting+clientsClaim; old buggy chunk now 404s; index.html served `no-cache, no-store`; LazyLoadErrorBoundary auto-clears caches + unregisters SW once on chunk error. |
| 8 | No undefined variables like STYLES | ✅ | STYLES→S fixed at source; `check-no-undef-render` ratchet at baseline 0 in build:safe; live chunk uses the real style object. |
| 9 | No React hook violations | ✅ | `react-hooks/rules-of-hooks` = 0 errors, enforced 3×: eslint error, build gate (step in build:safe), CI `hooks-guard` job; exhaustive-deps ratchet at 190. |
| 10 | Retry starts a clean scan session | 🟡 | Code-verified: boundary retry resets state + full reload; correlation id regenerated per scan; recovery chain state machine. Device confirmation rides item 1. |

## Also fixed this pass (W3, P1)
`www.farroway.app/api/*` 301-redirected to apex; fetch drops `Authorization` on the cross-origin
hop (observed live) and a 301 downgrades POST→GET. Fix: canonical-host redirect now applies to
page navigations only — `/api/*` answers on every bound host (`server/src/app.js`).

## Suite results (this pass)
- `npm run lint`-equivalent: eslint enforced inside build:safe (rules-of-hooks/no-undef gates) — green.
- `npm run typecheck`: **no such script exists in this repo** — not run, stated honestly.
- `npm test` (full suite): **14,461 passed / 50 failed / 3 skipped (14,514)**. All 50 failures were
  proven PRE-EXISTING by re-running the failing files with this pass's changes stashed (identical
  failures on the base commit — client api-refresh diagnostics, i18n meta-tests, asset-manifest
  meta-tests). Changed-area suite (`auth.test.js`): **30/30 green** incl. 2 new identity regressions.
  Burning down the 50 legacy failures is now a named Track A item (W8).
- `npm run build:safe`: **PASS — 411 steps green** (its final step IS the production Vite build,
  so a separate `npm run build` is redundant by construction).

## Verdicts
```
SCAN_READY:  NO — one item outstanding, and it is device-gated (item 1):
             the operator must run one real scan on the previously-failing device.
             If it succeeds → SCAN_READY flips YES.
             If it fails → tap "Export Diagnostic Report" and send the JSON;
             it contains the exact exception + stack + correlationId.
JARVIS_READY: NO — not built, by the spec's own gate ("Do not proceed to Jarvis until Scan
             passes") and the standing founder hold. Design is complete on feature/farmbrain-os
             (VOICE_PLATFORM.md, updated with this spec's deltas). The four Jarvis reports are
             not generated — reports for unbuilt software would be fabrication.
PILOT_READY: NO — tracked by the 12-criterion scoreboard in RELEASE_PLAN.md (this pass moves
             #5 journal persistence to fixed-pending-device-confirm and unblocks #12 telemetry
             identity).
```
