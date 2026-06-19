# FARM_BRAIN_TRACE_REPORT.md

**Sprint #209 (195B) — Decision Trace + Farm Timeline + Farm Quality.**
Date: 2026-06-19

A clean continuation of the Farm Brain foundation (#207/#208) — no
frozen collision this time. Three genuinely-new honest engines plus a
visible Home below-fold section. Empty-state replacement was already
shipped (#207) and is reused.

---

## What was built

| Spec section | Verdict |
|---|---|
| Decision Trace Engine | **BUILT.** `DecisionTraceEngine.ts` → `{recommendation, confidence, evidence, risks, contributors}`; signed contributors ("+ Onion selected", "+ Bulb Formation stage", …); `hasReason` guarantee |
| Farm Timeline | **BUILT.** `FarmTimeline.ts` — read-only over existing events, all 9 tracked kinds; newest-first; empty → guidance |
| Data Quality Engine | **BUILT.** `FarmDataQualityEngine.ts` → `{score, level, missingData, nextBestAction}`; score = weighted count of REAL present fields |
| Empty-State Replacement | ✅ **SHIPPED (#207)** — `FarmBrain.nextRecommendedAction` (add crop → scan → outcome); reused by Data Quality `nextBestAction` |
| Home — above fold | ✅ **SHIPPED (#192-#194)** — CommandCenterDeck (Health/Stage/Risk/Action/Reason/Confidence) |
| Home — below fold | **BUILT.** `FarmBrainBelowFold.jsx` renders Farm Quality + Farm Timeline under the hero on `Home.jsx` |
| Health checks | **BUILT.** `__farmBrainHealth()` gains `decisionTraceReady` / `timelineReady` / `dataQualityReady` |
| Build gates | **BUILT.** `check:farm-brain` extended |
| Report | this file |

---

## Architecture (text)

```
Home.jsx
  ├─ CommandCenterDeck (above fold) ── Health · Stage · Risk · Action · Reason · Confidence
  └─ FarmBrainBelowFold (below fold)
        ├─ buildFarmDataQuality(crop, location, plantingDate, scans, tasks, outcomes)
        │     → { score 0-100, level, missingData[], nextBestAction }
        └─ buildFarmTimeline(entries, pilotEvents)
              → ordered [{ kind, label, at }]  (9 kinds; empty → guidance)

DecisionTraceEngine.buildDecisionTrace(recommendation, confidence, crop,
  stage, weather, prevScanIssue, followUpOverdue, risks)
     → { recommendation, confidence(echoed), evidence[], risks[],
         contributors[ {sign,label} ], hasReason }
```

## Data model
No new tables. All three engines are pure read-only composites over
signals the app already holds (farm record, scan/task/outcome history,
pilot events). Timeline entries reflect REAL milestones — an entry
exists only when its underlying data exists.

## Health scoring model (Data Quality)
Weighted presence count: crop 25 · plantingDate 20 · scans 20 ·
location 15 · tasks 10 · outcomes 10 = 100. Level: strong ≥85 /
good ≥65 / fair ≥40 / low. `missingData` lists every absent signal;
`nextBestAction` is the highest-weight missing one. Always explained —
never a bare number.

## Task / decision model (Decision Trace)
Contributors are signed (+ supports / − against) and built only from
present signals: crop, stage, weather, prior-scan issue, overdue
follow-up. `confidence` is **echoed** from the recommendation, never
recomputed. `hasReason` is true whenever a recommendation is present —
the "no recommendation without reason" guarantee.

## Outcome model
Unchanged — Better/Same/Worse (#198) feeds the timeline
(`outcome_recorded`) and is available to Decision Trace as a
contributor source.

## Satellite readiness model
Unchanged from #208 — UNCONFIGURED foundation; none of the new
engines read or fabricate satellite.

## Build results
`check:farm-brain` extended (3 engines + readiness flags + Home
below-fold + i18n). `build:safe` green (commit).

## Success criteria
- No recommendation without reason → `DecisionTrace.hasReason` + gate.
- No health score without explanation → FarmHealth Why line (#194) +
  Data Quality `missingData`/`hasExplanation`.
- No empty state without guidance → #207 next-step + timeline empty
  guidance + quality `nextBestAction`.
- Timeline active → `FarmBrainBelowFold` renders it; populated from
  real farm milestones.
- Farm quality active → rendered above the timeline with score +
  improve-by list.

## KPI Impact (Founder Decision Rule)
Decision Trace deepens **Today's Action quality** (every action now
carries its signed contributors). Farm Quality gives the farmer a
concrete activation ladder (→ **Today's Action Started %** / data
completeness). Honest composition; no north-star moves until pilot
farmers generate the histories — still the one true unlock.
