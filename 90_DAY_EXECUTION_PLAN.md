# 90-DAY EXECUTION PLAN — Farroway pilot → production

Premise: the software is pilot-ready (360 build-safe gates, honest end-to-end,
security hardened, observability live). The next 90 days are about **evidence,
adoption, and production discipline** — not new architecture. KPIs below are TARGETS
to measure; current values are unknown until the pilot runs (no fabricated baselines).

**The one gating action (Day 0):** providers are keyed but read `DEGRADED` until a
real scan proves them. Do one real scan + `railway run npm run scan:certify` →
`PRODUCTION_CERTIFIED`. Nothing else in this plan unblocks without it.

---

## Phasing
- **Days 0–30 (Prove):** certify providers, onboard 5–10 farmers, instrument every
  KPI, establish the weekly review + bug-triage loop.
- **Days 31–60 (Improve):** act on pilot data — the top friction in onboarding/scan,
  the first labelled dataset, the ops alerting thresholds tuned to real traffic.
- **Days 61–90 (Scale-ready):** grow to 50–100 farmers, ship the CV-model spike if
  the labelled set supports it, decide go/no-go against the kill criteria.

---

## Workstream A — PRODUCT (exceptional farmer experience)
| Task | KPI (target) | How measured |
|---|---|---|
| Onboarding completion | ≥70% finish setup (crop + planting date) | funnel events (existing pilot analytics) |
| Scan speed | p95 end-to-end < 8s | `/api/admin/scan/reliability` latency |
| Offline mode | 100% of scans queued offline sync on reconnect | offline runtime probe |
| Multilingual | 0 untranslated leaks in en/fr/tw/sw/ha | i18n gates (Hindi stays hidden) |
| Voice guidance | ≥30% of low-literacy farmers use Listen | event counter |
| Accessibility | all scan tap targets ≥44px, contrast ≥4.5:1 | the staged #2 UX batch |
| Task completion | ≥50% of generated tasks marked done in 7d | FarmerActionLog |
| Notifications | ≥40% open rate on the daily plan | notification events |
| Recommendations | ≥60% "useful" on the scan result thumbs | ScanFeedbackPrompt |

**NOW:** certify providers; verify onboarding funnel fires for the first farmer.
**NEXT:** ship the #2 UX sweep (44px/contrast/larger confidence) — preview-verified.
**LATER:** voice-guidance coverage expansion once translation lands.

## Workstream B — MACHINE LEARNING (proprietary dataset)
See ML_DATA_COLLECTION_PLAN.md. Headline: the pilot SEEDS the dataset; 100k scans is
a scale goal, not a 90-day one.
**NOW:** turn on scan capture + the labelling queue; populate `golden-dataset/manifest.json`
with the first 100 verified images to set a real accuracy baseline.
**NEXT:** annotation workflow + QC for the first 1,000 labelled scans.
**LATER:** train + benchmark the first CV segmentation model (the #1 capability gap).

## Workstream C — OPERATIONS (run it like production)
See OPERATIONS_RUNBOOK.md. The reliability dashboard, swallow telemetry, and
`/api/health` already exist.
**NOW:** set alert thresholds on provider error rate + credit balance; name an on-call.
**NEXT:** wire the remaining dashboard tiles (DB/Redis/storage from `/api/health`).
**LATER:** OpenTelemetry/Prometheus export (only when farm count justifies it).

## Workstream D — PILOT (run a real one)
See PILOT_PLAYBOOK.md.
**NOW:** recruit 5–10 farmers; run the pilot checklist; first weekly review in 7 days.
**NEXT:** farmer interviews after week 2; triage the top 5 bugs.
**LATER:** grow to 50–100 if the scorecard clears the go criteria.

---

## Top-level success metrics (define now, measure throughout)
DAU/WAU · monthly active farms · scans/day · recommendation acceptance · task
completion · disease-detection accuracy (PENDING golden dataset) · farmer retention
(D2/D7/D30) · crash-free sessions · API uptime · avg scan latency.

**NOW** stand up the measurement (most events already fire). **NEXT** review weekly
against targets. **LATER** publish a monthly impact report once ≥30 farms are active.
