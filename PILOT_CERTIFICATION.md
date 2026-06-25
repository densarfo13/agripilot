# PILOT_CERTIFICATION — Farroway Pilot Certification v1.0

**Mission: feature freeze.** Every sprint from here must increase reliability,
trust, recommendation quality, or adoption — no speculative AI, no placeholder
intelligence. `__pilotCertificationHealth()` attests `featureFreeze: true`.

Most of the 8 phases were built across prior sprints; this certifies them as a
composite with an honest, COMPUTED verdict.

| # | Phase | Status | Backed by |
|---|---|---|---|
| 1 | Real-world certification | ◑ partial | ScanCertification (deterministic safety ✅); live photo accuracy PENDING |
| 2 | Recommendation quality | ✅ certified | Decision Engine — action/reason/urgency/time/benefit/confidence; rejects generic/dup/unsupported |
| 3 | Outcome engine | ✅ certified | recordDecisionFeedback (Better/No Change/Worse/Skipped) → evidence base |
| 4 | Trust engine | ✅ certified | ingestion gate + no-fabrication doctrine |
| 5 | Performance | ◑ partial | perf-budget + bundle-budget gates; live timing PENDING |
| 6 | Pilot dashboard | ✅ certified | PilotAnalytics (DAU/WAU/scans/acceptance/completion/outcomes/top disease+pest/confidence/uptime) |
| 7 | Production gates | ✅ certified | weak-scan-no-task, recommendation-needs-evidence, dedupe, provider-unavailable |

## Final verdict: **LIMITED PILOT**
Computed, honestly capped. The pilot machinery is certified; what's PENDING is
**field evidence**, not code:
- live crop-photo provider accuracy (operator run on production)
- live performance timing (field measurement)
- real farmer adoption data

`READY FOR 100 / 1000 FARMERS` is NOT claimed from the sandbox — it requires the
live run + real adoption metrics. The gate fails the build if the verdict is
hardcoded to a ready tier or any accuracy/adoption % is fabricated.
