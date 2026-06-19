# FARROWAY_PILOT_READINESS_AUDIT.md

**Sprint #196 — Pilot Readiness Audit (audit only, no new features).**
Date: 2026-06-19 · Branch `master` @ `24c15de6` · `build:safe` 293 gates green.

Method: each item verified against live source (component testids,
runtime exports, gate scripts) + the passing gate suite — not asserted
from memory. Honest-null where a value can't be measured pre-pilot.

---

## Section 1 — Home Experience · **PASS**

| Item | Evidence |
|---|---|
| Farm Health visible | `CommandCenterDeck` `farmHealth` + Why line (#194) |
| Crop Stage visible | `cropStage` field |
| Top Risk visible | `riskLevel` + sub-risk chips |
| Today's Action visible | `data-testid="cc-today-action"` / `cc-action-title` |
| Reason visible | `action.why` line |
| Confidence visible | `data-testid="cc-action-confidence"` |
| Start button visible | `data-testid="cc-btn-start"` |

All seven render above the fold (verified #192-#194/#207). **PASS.**

## Section 2 — Scan Experience · **PASS**

| Item | Evidence |
|---|---|
| Plant visible | `PlantIdentificationSection` (ladder-resolved, never empty) |
| Confidence visible | `scan-intel-confidence-breakdown` (#207) |
| Issue visible | issue chip (`_issueType`) |
| Why visible | `scan-intel-mythos-why` (#201) |
| Limitations visible | `scan-intel-mythos-limits` |
| Next Action visible | next-action row (envelope-sourced) |
| Follow-up visible | follow-up date (severity-driven #201) |
| NO `Plant: —` / `Unknown Plant` / `Needs Review` only | gate-locked: `check-universal-scan` §7b + `check-scan-no-dead-ends` (#179) |

**PASS.** Bonus: contradicting observations (#206) now also shown.

## Section 3 — Task Experience · **PASS**

| Item | Evidence |
|---|---|
| Action | `SimpleActionCard.renderAction` |
| Reason | `renderReason` |
| Time | `renderWhen` |
| Start | `cc-btn-start` (hero) + `TodaysActionCard.onStart` |
| Done | `SimpleActionCard.handleDone` |

**PASS.** Start lives on the hero + action card; Done on the task card.

## Section 4 — Outcome Loop · **PASS**

Better / Same / Worse → statuses `improved` / `same` / `worse`,
fires `outcome_recorded` pilot event, persists via OutcomeChainRuntime
(#36/#198). Verified in `OutcomePrompt.jsx`. **PASS (stored correctly).**

## Section 5 — Language Consistency · **PASS (5 visible locales)**

6-locale structural parity: **6505 keys each** (en/fr/sw/ha/tw/hi).
Real translation: en 100% · fr/sw/ha/tw 99.2% · **hi 53.9%**.
Hindi is **intentionally hidden** (`enableHindiLocale: false`, #205)
until translated — so no farmer sees a mixed Hindi screen.
No `{key}` leaks / blank labels (gate-locked: `audit:i18n`,
`check-language-consistency`, `__farrowayLanguageLeaks`). **PASS** for
the 5 visible locales; Hindi deferred by design (see High-1).

## Section 6 — Farm Brain · **PASS**

| Item | File |
|---|---|
| Farm Memory | `FarmBrain.ts` + `FarmBrainRuntime.getFarmBrain` (#207/#208) |
| Decision Trace | `DecisionTraceEngine.ts` (#209) |
| Timeline | `FarmTimeline.ts` (#209) |
| Data Quality | `FarmDataQualityEngine.ts` (#209) |

`__farmBrainHealth()` reports all readiness flags true; gate-locked
(`check-farm-brain`). **PASS.**

## Section 7 — Empty States · **PASS**

`No activity yet` / `Not enough data yet` replaced with guidance:
Home hero → `FarmBrain.nextRecommendedAction` (add crop → scan →
outcome, #207); timeline empty → guidance; quality → `nextBestAction`
(#209). **PASS.**

## Section 8 — Pilot Analytics · **PASS (instrumented) / NEEDS_DATA (values)**

All seven metrics are declared + wired in `PilotMetricsAggregator`:
`todayActionStarted`, `todayActionCompleted`, `scanSuccess`,
`outcomeCapture`, `followupCompletionRate`, `d1Retention`,
`d7Retention`. The pipeline is gate-locked (`check-pilot-analytics`,
24 canonical events). **The values read null/0 — by design, because
there are zero pilot users.** D1/D7 retention is mathematically
unmeasurable without users. **PASS** on instrumentation; the data
layer is NEEDS_DATA until the pilot cohort exists.

---

## Scorecard

| Category | Score | Note |
|---|---|---|
| Architecture | 98 | 293 gates green; composition-only; honest-null discipline |
| Localization | 90 | 5 locales 99-100%; Hindi hidden until translated |
| Scan | 96 | gate-locked, no dead ends, two-sided evidence |
| Farm Brain | 95 | 4 engines shipped + gated; below-fold live on Home |
| Task Engine | 94 | action/reason/time/start/done all present |
| Outcome Engine | 92 | Better/Same/Worse stored; capture rate pending users |
| Pilot Analytics | 80 | fully instrumented; values NEEDS_DATA (no users) |
| Mobile UX | 85 | premium shell (#133); verified by gates, not pixel (see Med-1) |

**Overall: 91 / 100.**

## Verdict

### ✅ READY FOR PILOT (engineering)

Every grower-facing surface the spec lists is built, rendered, and
gate-locked. There is **no code blocker** to onboarding farmers. The
only readings at zero (pilot-analytics, outcome-capture, D1/D7) are
zero *because there are no users yet* — not because anything is
broken. They become real the moment the first farmer acts.

**The gating item is non-code: onboard the Phase-1 cohort (10-20
farmers).** Until then, "readiness" is proven by gates, not by data.

---

## Remaining issues

### Critical
- **None.** No code defect blocks the pilot.

### High
1. **Hindi at 53.9% (hidden).** Not a leak — but if Phase-1 includes
   Hindi-speaking farmers, Hindi is unavailable. Decision already made
   (#205): hide until translated. Resolve by funding a translator for
   the ~2,985-key queue, or confirm Phase-1 is non-Hindi regions.
2. **Pilot analytics unproven by data.** Instrumented + gate-locked,
   but every KPI reads null pre-pilot. Readiness is engineering-proven,
   not data-proven. Resolves automatically once users act — but means
   the success metrics can't be validated until then.

### Medium
1. **Mobile UX not pixel-verified.** Premium mobile shell shipped
   (#133) and gate-checked, but the preview screenshot tooling times
   out in this environment — no visual regression pass. Recommend a
   real-device smoke test (iOS Safari + Android Chrome) before launch.
2. **~3,000 translator-review keys** (hi bulk + ~53 each fr/sw/ha/tw).
   English fallback is safe; no leak. Translator task.
3. **Funding catalog English copy** (`fundingConfig.js`) — data
   catalog, translator task; Funding is a P1 surface.

### Low
1. **IntelligenceStatusStrip interpolation suffixes** ("Drainage:",
   "demand") — minor, lower-priority strip; not farmer-critical.
2. **FarmBrain below-fold history arrays** — Home passes farm/crop/
   planting milestones to the timeline but not yet scan/task/outcome
   history (empty arrays). Timeline + quality are live; wiring the
   remaining histories is a follow-up once pilot data flows.

---

## One-line readiness statement

**Farroway is engineering-ready for pilot (91/100, 0 critical
issues). The last mile is not more code — it is the first 10-20
farmers, whose actions turn the zero-reading KPIs into real data and
prove in the field what the gates already prove in CI.**
