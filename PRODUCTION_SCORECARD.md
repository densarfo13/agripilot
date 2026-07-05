# PRODUCTION_SCORECARD — v10

| Capability | Status |
|---|---|
| Object classification (17 classes) | ✅ shipped (8 new this sprint) |
| Every-scan intelligence fields | ✅ shipped |
| FarmBrain timeline/recommendation updates | ✅ shipped |
| Multi-image / progression | ✅ shipped (composer) |
| Risk engine | ✅ shipped |
| Confidence + evidence + trust | ✅ shipped |
| Quality control (reject bad photos) | ✅ shipped |
| Auto-improvement (outcome → thresholds) | ◑ feedback stored; learning ≥50 samples |
| Admin dashboard (health/accuracy/latency/queue) | ✅ endpoints; diagnostics |
| Scan API surface (6 endpoints) | ✅ complete |
| Ripeness / grade / storage (CV) | ◑ honest advisor (no fabricated score) |
| Field intelligence (counts/canopy) | ◷ needs CV model |
| <3s / >99% / 99.9% crash-free | ◷ measured live (reliability scorecard); PENDING field |
| 20,000-image dataset benchmark | ◷ PENDING population |

**Verdict: extended + gated.** The platform classifies any of the listed objects
and returns an honest, evidence-based recommendation; CV-dependent measures and
the field dataset are honestly PENDING, never fabricated.

---

## Production Certification Sprint — 12-workstream scorecard

Evidence (this session): `build:safe` **399 gates green**; safety-critical tests pass live —
FarmBrainScanIngestion, SellDecisionEngine (20), ClassifyLocationError (36), scanRetryEngine (28),
scanLifecycleCertification (12). Scores are **code-readiness**; device/live-data dimensions are
**field-pending** and cap a workstream below 97 — which is why the verdict is PILOT READY.

| # | Workstream | Code score | Critical | High | Field-pending |
|---|---|---|---|---|---|
| 1 | Production readiness (auth/session/offline/sync/retry/nav/recovery) | 95 | 0 | 0 | on-device session + offline |
| 2 | Scan (failure handling, retry, no data corruption) | 96 | 0 | 0 | real camera + real-image accuracy |
| 3 | Recommendation (no fabrication; unknown stays unknown) | 96 | 0 | 0 | content quality on real data |
| 4 | Marketplace (honest sell decision) | 95 | 0 | 0 | live buyer data |
| 5 | Funding | 88 | 0 | 1* | live program data |
| 6 | Enterprise (isolation/audit/exports) | 92 | 0 | 0 | scale + real exports |
| 7 | Performance | — | 0 | 0 | **no runtime measurement** |
| 8 | Accessibility (48px + no-color-only) | 90 | 0 | 0 | device VoiceOver / dynamic type |
| 9 | Localization (parity, no raw keys) | 90 | 0 | 0 | on-device leak check; fr/tw/sw/ha 95–97% |
| 10 | Security (authz/secrets/rate-limit/audit) | 88 | 0 | 1* | **pen-test + dep-scanning** |
| 11 | Observability | 90 | 0 | 0 | **2/10 telemetry events wired; no live data** |
| 12 | Pilot readiness | — | — | — | see PILOT_CHECKLIST.md |

\* High = *missing verification* (pen-test; live funding data), not a known defect.

**Overall:** code-readiness ~93/100, **0 critical / 0 high defects**. The full-production 97 bar is
**not met** — Performance has no measurement, Security has no pen-test, Observability has near-zero
live data. These are *unverified*, not *failed*. → **⚠ PILOT READY** (GO_NO_GO_DECISION.md).

---

## 2026-07-05 — 90-day production-excellence freeze (Farroway OS optimization spec)

**The freeze is ratified and matches standing governance** (RELEASE_PLAN Track A). Phase-by-phase
honest status, with the canonical artifact for each requested scorecard (Build Once — no duplicate
docs; one ranked backlog):

| Phase | Status | Canonical artifact / evidence |
|---|---|---|
| 1 Hardening | 🟡 code-complete; DEVICE-PENDING | Loading/offline/retry/error/recovery exist per workflow (SW shell, queues, boundaries, recovery chains); the per-workflow device matrix is TOP_50_FIXES #9 (checklist exists: docs/PRODUCTION_ACCEPTANCE_TEST.md) |
| 2 Quality | 🟡 | ESLint errors 0 (gate-enforced) · hooks 0 (3× enforced) · deps-warnings ratchet 190 · console-errors: capturable, unmeasured (#21) · AA: partial (#20) · localization parity gates green; fallback-only debt 1,137 (#19) · "100% typed APIs": no typecheck script exists — honest gap, not faked |
| 3 Performance | 🟡 measured-synthetic | TTFB 68–149 ms warm · scan <5 s server-side · main chunk 375 KB gzip (#15) · boot deferral (#16) · FIELD vitals unmeasured → RUM (#17) |
| 4 Observability | 🟡 | Client diagnostics persist every uncaught exception w/ correlationId+device+language+stack+recovery; gaps: app-version+flag-state fields (#26) and server-side persistence (#6). "No silent failures" holds client-side by construction |
| 5 Pilot dashboards | 🟡 exists, starved of data | pilot-metrics/analytics pages already built; scan-success/crash-free/avg-confidence light up when #6/#7 land (#25). No new dashboards needed |
| 6 UX | 🟢/🟡 | UX_AUDIT.md (2026-07-05) — low-confidence flow production-quality; after-P0 polish list ranked (#34/#35) |
| 7 Jarvis | 🟢 improve-only honored | MVP on feature/farroway-jarvis-mvp, flag-off, 13/13 tests; measurement plan #33 — no expansion |
| 8 Security | 🔴 new findings | **19 prod-dependency vulns (5 high)** found by audit today (#3/#4) + no dep-scan gate (#5); helmet+24 rate-limiters+2 MB body limit present; MIME guard (#8), JWT-expiry review (#28), pen-test standing gap (#32) |

**Requested-doc crosswalk:** UX_SCORECARD→`UX_AUDIT.md` · PERFORMANCE_SCORECARD→this file +
`PERFORMANCE_REPORT.md` (local; deliberately gitignored) · SECURITY_SCORECARD→Phase-8 row +
TOP_50_FIXES Tier 1/3 · PILOT_READINESS→`RELEASE_PLAN.md` scoreboard (0/12 green, device-gated) ·
JARVIS_SCORECARD→`JARVIS_TEST_REPORT.md` (branch) · TOP_50_FIXES→`TOP_50_FIXES.md` (35 evidence-backed
items — not padded to 50).
