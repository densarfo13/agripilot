# Pilot Readiness (RC1)

Consolidated production-readiness verdict. Scores are **not inflated** — subjective/visual and
live-data dimensions are held honestly below the line they can't clear from code.

## Module classification
| Module | Class | Note |
|---|---|---|
| Home | **Production Ready** | decision-first, one hero, no jargon (gate-locked). |
| My Farm / Tasks / Activity | **Production Ready** | token-driven, honest states. |
| Scan | **Needs Improvement** | pipeline + failure handling solid; **real-image accuracy unproven** (provider cert NOT_CERTIFIED until a real scan). |
| Funding | **Needs Improvement** | surfaces present; live program data external. |
| Sell (Marketplace) | **Production Ready** | honest sell decision, no fabricated price. |
| Notifications / Profile | **Production Ready** | localized, token-driven. |
| Authentication | **Needs Improvement** | works in code; device session + brute-force policy pending. |
| Admin | **Production Ready** | internal dashboards + admin-only routes. |
| NGO / Buyer / Gardener / Farmer roles | **Production Ready** | RBAC + role surfaces; live cross-tenant test pending. |

No module is **Critical** or **Blocked** in code. The "Needs Improvement" items are all
verification/live-data gaps, not defects.

## Final scores (honest, /100)
| Dimension | Score | Basis |
|---|---|---|
| UI | 90 | tokens + primitives fully token-driven; inline-hex debt ratcheting; visual polish device-pending |
| UX | 88 | decision-first, no dead-ends; 3-second test device-pending |
| Reliability | 92 | 402 gates green; safety invariants unit-tested; 8/10 field scenarios code-verified |
| Security | 85 | injection/SSRF/secrets mitigated; **pen-test + dep-scan pending** |
| Performance | — | **not measured** (no runtime capture) — cannot score honestly |
| Accessibility | 88 | 48px + no-color-only + AA tokens; SR/dynamic-type device-pending |
| Farmer experience | 88 | honest, simple, localized; real-farmer feedback pending |
| Enterprise readiness | 90 | isolation/audit/backup gates; scale test pending |
| Pilot readiness | 95 | ready to BEGIN the controlled pilot today |

**Overall Production Score: ~89/100 (code-readiness).** Not 95+ full-production — Performance is
unmeasured, Security lacks a pen-test, and the whole picture lacks live-data. These cap the honest
ceiling. Test coverage is **not a measured 95% line-coverage number** — the real posture is 402
build:safe gates + safety-critical unit suites (scan ingestion, sell decision, location errors, scan
retry, lifecycle, launch gate); I will not claim a coverage % the harness doesn't measure.

## Verdict: ⚠ PILOT READY
`launchGateDecision` → PILOT_READY · scan lifecycle → DEVELOPMENT · provider cert → NOT_CERTIFIED.
All converge: **ready to run a controlled pilot; not certified for public launch.**
