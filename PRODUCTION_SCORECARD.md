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
