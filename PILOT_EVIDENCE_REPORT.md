# PILOT_EVIDENCE_REPORT.md — Farroway

> 2026-07-06 · Honest map of the pilot evidence layer that **already exists** (verified by wiring —
> written/read per model), not a new layer. Nothing fabricated; "not recorded yet" is shown where a
> signal has no live source. No engine, model, or schema was added to produce this.

## Root finding
Farroway already has a pilot evidence layer — models, feedback persistence, outcome tracking, pilot
metrics, NGO/admin dashboards, and telemetry, built across sprints #37/#157/#170/#188/#189/#209/#218.
The gap is **not "no evidence layer" — it's that some captured evidence is never surfaced.** Building
a second layer would duplicate it (which this spec's own rules forbid).

## What evidence is REAL and fully wired (written → read → shown)
| Signal | Model | Status |
|---|---|---|
| Recommendation outcome | `RecommendationOutcome` | ✅ written **and** read |
| Outcome feedback | `OutcomeFeedback` | ✅ written **and** read |
| Harvest result | `HarvestOutcome` | ✅ written **and** read |
| Pilot metrics (farmers, scans, activity) | reads `Farmer` / `FarmProfile` / `AuditLog` / `FarmerNotification` | ✅ `pilotMetricsService.js` on **real stored data**, not fabricated |
| Scan feedback capture | `ScanFeedback` | ✅ **written** — `POST /api/scan/feedback` (`app.js:2622`), from `ScanFeedbackPrompt.jsx` |

## What is CAPTURED but NOT yet surfaced (the real gap)
| Signal | Model | Gap |
|---|---|---|
| Farmer "was this helpful?" | `ScanFeedback` | **written, read in 0 files** — collected on every scan, shown on **no** dashboard. Wire a read into the NGO/admin scorecard to close the loop. |
| Recommendation feedback | `RecommendationFeedback` | written, read in 0 files — same. |

**This is the highest-value, lowest-risk pilot improvement:** the data is already being collected
honestly — it just needs a read + a card in the existing pilot dashboards. No new model, no new engine.

## What is DORMANT (declared, never written or read)
- `V2TreatmentOutcome`, `V2DiagnosisFeedback` — models exist but 0 writers/readers. Either wire them
  to the scan/treatment flow or leave as provisioned-not-wired. **Do not report metrics from them** —
  they'd be empty (honest "not recorded yet").

## What must stay "not recorded yet" (never fabricate)
Per the canonical `FarmBrainState` contract (`no_live_feed`): **buyer readiness, market quality,
expected grade, yield $, harvest value.** The pilot must show these as *not recorded yet* until a real
market-data feed exists. The P8 "buyer dashboard predictions" cannot be built honestly today.

## How NGOs should use it (with the real signals)
- **Adoption:** farmers onboarded, scans completed (`pilotMetricsService` — real).
- **Engagement:** recommendation acceptance + task completion (`RecommendationOutcome` — real).
- **Recovery signal:** `HarvestOutcome` + follow-up (`followUpEngine.js` — real).
- **Farmer sentiment:** `ScanFeedback` — real **once the read is wired** (currently captured only).
- Everything else (yield $, buyer value) → **"not recorded yet"**, honestly.

## How the pilot should measure success
Count only what's really stored: scans/farmer, recommendation-acceptance rate, task-completion rate,
follow-up-completion rate, and — once wired — the helpful/not-sure/no feedback split. Do **not** report
crop-recovery % or yield improvement until `HarvestOutcome` rows accumulate from real follow-ups.

## Remaining gaps (ranked)
1. **Surface `ScanFeedback`** in the NGO + admin pilot scorecards (data already collected — 1 read + 1 card).
2. **Wire or retire** `V2TreatmentOutcome` / `V2DiagnosisFeedback` (dormant).
3. **The real blocker is operational, not code:** the pilot has no *evidence* yet because there are
   no real farmer scans yet — which loops back to the standing release blocker (one real device scan +
   provider keys at Railway). The evidence layer is ready to record; it just needs real traffic.

## What I did NOT do (per the spec's own rules)
No new evidence engine/model/schema (they exist); no fabricated outcomes (dormant models report
nothing, not zeros-as-success); no buyer/yield predictions (`no_live_feed`).
