# RELEASE_PLAN.md — Track A (Release Candidate)

**Ratified 2026-07-05.** Farroway is in Release Candidate mode. Two tracks:
- **Track A (this document, `master`)** — ship the best agricultural platform possible to real
  farmers. Highest priority. No roadmap expansion until Scan P0 is closed.
- **Track B (`feature/farmbrain-os`)** — future vision, completely isolated. Nothing from that
  branch may affect Release. See `NEXT_BRANCH_CHECKLIST.md` on that branch for the entry gate.

## Allowed work (Track A)
Scan stability · Authentication · Localization · Performance · Security · Telemetry ·
Offline support · Bug fixes · Accessibility · Deployment · Monitoring.

## Forbidden (Track A)
New AI features · new dashboards · new domains · new databases · new marketplace modules ·
new funding intelligence · new Jarvis/voice implementation (parked — founder decision 2026-07-05).

---

## Exit criteria — honest status (evidence as of 2026-07-05, deploy `15b2dd68` / commit `34da50b8`)

| # | Criterion | Status | Evidence / gap |
|---|-----------|--------|----------------|
| 1 | Scan success > 99% | 🔴 OPEN P0 | Server path healthy (analyze → 200, plant.id 200, 3–5 candidates). A device still reaches the fallback AFTER the 200. Client diagnostics shipped (`CLIENT_DIAGNOSTICS.md`); the exact exception is persisted on-device and awaits the operator's **Export Diagnostic Report**. |
| 2 | No React runtime errors | 🟡 PARTIAL | Static: rules-of-hooks = 0, enforced by build gate + CI (`REACT_HOOKS_GUARD_REPORT.md`). Dynamic: all 5 result components render clean against a real production envelope (jsdom, effects on). The un-captured production exception (#1) is the remaining unknown. |
| 3 | Crash-free sessions > 99.9% | ⚪ NOT MEASURED | No crash-free-session metric exists yet. Client diagnostics now persist every uncaught exception — a session counter derived from it is Track A work (W5). |
| 4 | Result page always renders | 🔴 BLOCKED BY #1 | Verified in isolation against the real envelope; NOT yet verified on the failing device. Done = one real scan reaches the result screen on that device. |
| 5 | Journal persistence verified | 🟡 FIXED SERVER-SIDE (2026-07-05) | W2 shipped: `id: payload.sub` aliased on both auth paths + 2 regression tests (auth suite 30/30). Pre-fix rows with null userId remain orphaned (backfill = separate decision). Device confirmation of journal round-trip pending (W6). |
| 6 | Tasks created | ⚪ NOT VERIFIED | Task-from-scan / daily-plan creation not yet verified on device this cycle. Part of the acceptance run (W6). |
| 7 | Recommendations displayed | 🟡 PARTIAL | Envelope carries recommendations/nextAction; render verified in jsdom. Device confirmation pending (#1). |
| 8 | Camera retry works | 🟡 PARTIAL | PlainUploadFallback (no-camera path) + retry + LazyLoadErrorBoundary auto-recovery exist. Device pass pending (W6). |
| 9 | Offline handled gracefully | 🟡 PARTIAL | SW `OFFLINE_SHELL_V1` (HTML network-first, assets cache-first) + offline scan queue exist. Airplane-mode acceptance pass pending (W6). |
| 10 | iPhone Safari verified | 🔴 PENDING | No verified pass; the known failing device is the priority. Protocol: `docs/PRODUCTION_ACCEPTANCE_TEST.md`. |
| 11 | Android Chrome verified | 🔴 PENDING | No verified pass this cycle. Same protocol. |
| 12 | Production telemetry healthy | 🔴 BROKEN | Client POSTs to `/api/v2/analytics/track` return 200, but no rows were found in `analytics_events` for the scanning user, and W2 nulls `userId` on writes that do land. Telemetry cannot certify #1/#3 until fixed (W4). |

**Scoreboard: 0 green / 6 partial-or-at-risk / 5 red / 1 unmeasured. Release does not exit until all 12 are green.**

### Production score (2026-07-05, evidence-based — not a vanity number)
| Dimension | Score | Basis |
|---|---|---|
| Engineering quality | **A− (≈90/100)** | build:safe 411 gates green; rules-of-hooks=0 (build+CI); no-undef ratchet 0; 14.5k tests passing (50 legacy fails, W8); server perf under budget; W2/W3 identity+redirect bugs fixed & verified live. |
| Farmer UX (Scan) | **B+ (≈85/100)** | Low-confidence result is production-quality (one guidance surface, honest confidence, camera tips, ≥48px a11y, 6 locales). Gaps: full WCAG-AA pass; delight layer after P0. |
| Performance | **B (≈80/100)** | TTFB fast; scan < 5s; lazy i18n + code-splitting. Gap: 375 KB-gzip main chunk; no field RUM yet. |
| Release readiness | **BLOCKED** | 0/12 exit criteria fully green — gated on ONE device-verified scan (criterion #1). |
| **Composite** | **PILOT-CANDIDATE, not GA** | Strong engineering; release blocked by a single device-gated P0. |

**The score does not move to "release-ready" on more code — it moves when one real scan reaches the
result screen on the failing device.** Everything else is secondary to that one action.

---

## Work items (priority order)

- **W1 — Capture & fix the Scan post-200 exception (P0, BLOCKING).**
  Operator: on the failing device, reproduce → tap **Export Diagnostic Report** → send JSON
  (contains message/stack/componentStack/correlationId/scanId/phase). Then: fix the identified
  defect at source, add regression, verify one real scan reaches the result screen. Everything
  else in this plan is secondary to this loop.
- **W2 — Fix the `req.user.id` identity bug (P0, server).**
  `verifyUserFromPayload` must set `id: payload.sub` on `req.user` (both cache-hit and DB paths),
  with a test. Un-breaks `/api/scan/history` 401s, null-userId scan persistence, and every other
  `req.user.id` reader (~9+ routes in `server/src/app.js`). Audit journal/tasks writes for the
  same pattern. (Authentication — allowed work.) **DONE 2026-07-05 — SCAN_P0_CLOSEOUT_REPORT.md.**
- **W3 — Stop the www→apex 301 on `/api/*` (P1, server).**
  `https://www.farroway.app/api/*` 301-redirects to apex; fetch drops the `Authorization` header on
  the cross-origin hop → spurious 401s for any client loaded on the www host (observed live).
  Exempt `/api/*` from the canonical-host redirect (serve API on both hosts). (Bug fix/security.)
  **DONE 2026-07-05.**
- **W4 — Make telemetry persistence real (P1).**
  Verify `/api/v2/analytics/track` + `/events` actually write `AnalyticsEvent` rows with a real
  `userId` (depends on W2); confirm the scan lifecycle (scan_opened → scan_completed /
  scan_fallback) lands end-to-end. Criterion #12; prerequisite for measuring #1 and #3.
- **W5 — Crash-free-session metric (P1).**
  Derive sessions-with-uncaught-exception from the shipped client diagnostics + telemetry (a
  counter, not a dashboard). Criterion #3.
- **W6 — Device acceptance matrix (P1, operator-run).**
  Execute `docs/PRODUCTION_ACCEPTANCE_TEST.md` on iPhone Safari + Android Chrome: scan happy path,
  low-confidence path, camera-denied → upload fallback, offline queue, journal + task persistence
  (post-W2), language switch (en/fr/sw/ha/tw). Criteria #6, #8, #9, #10, #11.
- **W8 — Legacy test-failure burn-down (P2).**
  The full server suite carries 50 pre-existing failures (client api-refresh diagnostics, i18n
  meta-tests, asset-manifest meta-tests) — proven pre-existing via stash-compare 2026-07-05.
  Burn to zero so `npm test` becomes a trustworthy release signal.
- **W7 — Localization burn-down (P2, continuous).**
  Farmer-facing ratchet ≤ 1,137 and falling, by user impact (onboarding ≈ 90 keys next). Gates:
  `i18n:farmer-gate`, `check:translations` (all green at 411 steps today).

## Operating rules
1. Every change runs `npm run build:safe` (411 gates) before commit; deploy via Railway; verify the
   deployed bundle when the change is farmer-visible.
2. Every commit declares KPI Impact (pilot execution mode).
3. Report sprawl: new evidence goes in THIS file's table, not new one-off audit reports.
4. Any spec that adds surface area is Track B by definition — it goes to `feature/farmbrain-os`
   (as design docs only) and does not land on `master` until the exit criteria above are green.

**Definition of done for Release:** all 12 criteria green, each backed by production evidence
(telemetry or an operator-verified acceptance run), and the founder signs off in
`NEXT_BRANCH_CHECKLIST.md` before Track B implementation begins.
