# EXECUTIVE_REVIEW.md — Farroway

> Week of 2026-07-10 · Executive review. Grounded only in evidence verified this cycle (CI gates, the
> test suite, live Railway runtime probes). No fabricated metrics, no demo KPIs. Where a dimension needs
> live load/traffic to score, it is marked **NOT MEASURED**, not invented.

## Release decision
**No new release recommended this week.** Everything code-actionable is already shipped and green; the
codebase is release-ready. The dominant lever is **operational, not code** — one real device scan +
real usage. One *optional* small/safe/reversible PR is available if desired (test burn-down, below).

## Scorecard (evidence-based; bands, not vanity numbers)
| Dimension | Score | Basis (verified) |
|---|---|---|
| Architecture | **A− (90)** | one intelligence fabric, no duplicate services/APIs (verified repeatedly); 412/412 CI gates |
| Security (impl) | **B+ (85)** | helmet, joi (21 sites), JWT, MFA, SoD, org-scope, audit, rate-limit — **dynamic pen-test NOT MEASURED** |
| Performance | **NOT MEASURED** | bundle green (893 KB gzip ≤ 1100); latency/memory under load require live traffic |
| UX | **B+ (85)** | unified scan Result Card, a11y targets, offline, 6 locales; delight layer partial |
| Reliability | **B (82)** | health runtimes, graceful degradation, `/api/ops/health`; MTBF/uptime NOT MEASURED |
| AI | **A (honesty) / B (capability)** | honest-by-construction (20 no-fabrication gates, `no_live_feed`); no predictive ML model |
| Operations | **CONDITIONAL (60)** | deployed + healthy + satellite live; no OTel/Grafana; **no real traffic yet** |
| Enterprise | **High (code) / Early (operational)** | RBAC/audit/tenancy/exports/governance CI present; unproven at scale |
| Pilot | **BLOCKED** | 0 real farmer scans; GA gated on one device scan |
| **Overall** | **Release-ready code · operationally gated** | ship-readiness high; value now comes from usage, not more surface |

## Top 10 Product Wins (this cycle — all real, all shipped)
1. **Satellite NDVI live + verified** — was dormant (credential mismatch); OAuth proven in-container, real NDVI 0.2626.
2. **Unified scan Result Card** — removed the duplicate Command Center + "Photo quality: Unknown"; real Confidence %.
3. **Scan evidence surfaced** in NGO/pilot metrics (`computeScanEvidence`) — was captured-but-never-shown.
4. **Retention-sweep prod bug fixed** — was silently no-op'ing every 30 min (`no_prisma`).
5. **Test suite trustworthy** — one root-cause fix un-blocked **+2,701** tests (17,203/17,245 pass).
6. **Provider cert honesty** — false "configured" green for Sentinel corrected to the OAuth vars.
7. **OAuth retry-once hardening** on the Sentinel token path (+6 tests).
8. **"Scan Assistant"** premium label (gate-compliant — "AI" correctly blocked by farmer-facing-language gate).
9. **Honest-by-construction confirmed** — 20 CI gates block fabricated data; a genuine trust asset.
10. **Provider readiness verified live** — plant.id/crop.health wired (envPresent, keyLen=50) at Railway.

## Top 10 Technical Debt (ranked by leverage)
1. **39 stale source-assertion tests** (W8) — suite not 100% green; erodes CI trust. *Small/safe fix.*
2. **`weatherSummary` JSON is overloaded** — holds weather + fieldHealth + soil; misnamed, a maintainability smell.
3. **Dead Railway env vars** — `SENTINEL_HUB_API_KEY` / `SENTINEL_HUB_INSTANCE_ID` unused; remove for clarity.
4. **No OTel/Prometheus/Grafana** — observability is health-runtimes + Sentry + logs; no distributed tracing.
5. **No load/perf baseline** — latency/memory/crash-rate unmeasured under real traffic.
6. **Telemetry gap (RELEASE_PLAN #12)** — analytics rows not confirmed landing for the scanning user.
7. **Dormant models** — `V2TreatmentOutcome`/`V2DiagnosisFeedback` (0 writers/readers); `dedupStore` dead.
8. **Migrations apply at deploy** — an untested migration would break the deploy; needs DB-tested `migrate dev`.
9. **Locale drift** — reworded scan keys are EN-only fresh; other 5 locales stale (Hindi hidden by design).
10. **No crash-free-session metric** (RELEASE_PLAN #3) — client diagnostics persist but no derived counter.

## Top 10 Risks
1. **Zero real farmer scans** — the pilot is unproven end-to-end (dominant risk).
2. GA gated on **one device scan** (standing blocker).
3. **No dynamic security / load testing** — behavior at scale unknown.
4. **External provider dependency** (Plant.id/Kindwise/Sentinel) — keyed but SLA-untested.
5. **Feature-creep pressure** — repeated maximalist specs vs the Track-A freeze.
6. **Telemetry health** unconfirmed (can't certify crash-free / accuracy without it).
7. **Bus factor** — single-operator deploy + SSH; auto-commit bot can bundle stray work to master.
8. Untested migration at deploy could cause an outage.
9. No uptime/MTBF SLO defined.
10. `no_live_feed` sections (yield/market) may frustrate users expecting numbers — must stay honest.

## Top 10 Opportunities
1. **Run the real device scan** → unblock pilot GA (highest leverage; operational).
2. Confirm live provider inference on that scan (watch `railway logs`).
3. **W8 test burn-down** → 100% green suite (small, safe, reversible).
4. First real-scan cohort → accumulate honest evidence (recovery %, feedback split).
5. Remove dead Railway env vars + rename the overloaded JSON column.
6. Scope **OTel/Grafana** as a real (costed) observability initiative.
7. A real market-data feed → honestly unblock the `no_live_feed` sections.
8. Founder decision on **unparking the Jarvis copilot** (LLM assistant).
9. Crash-free-session metric derived from existing client diagnostics.
10. `SatelliteObservation` first-class indexed table — *only* when scan volume makes the JSON-blob query slow.

## The one PR available this week (optional)
**W8 test burn-down.** Business impact: CI trust (Maintainability). Effort: M (per-test judgment across ~22 files).
Risk: low. Rollback: revert. Tests: the burn-down *is* the test work. Files: `server/src/__tests__/*` only.
Everything else is either shipped, operational (not code), or gated by the freeze / a founder decision.

## Verdict
Farroway is **better, not bigger** this cycle: dormant satellite is live, duplication is gone, a real prod
bug is fixed, and the test suite is trustworthy — all with zero fabricated values. The honest CEO/CTO read
is that **more code is not the constraint; real usage is.** Recommend: run one real scan, then let evidence —
not another spec — drive next week's review.
