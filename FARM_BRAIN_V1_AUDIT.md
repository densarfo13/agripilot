# FARM_BRAIN_V1_AUDIT.md

**Sprint #207 — "Mythos Farm Brain V1" audit + honest deltas.**
Date: 2026-06-19

This spec overlaps #200/#206 heavily and re-requests the frozen
satellite integration for the **third** time. Per the Execution
Policy I audited each section, built the honest deltas, declined the
frozen one, and noted the duplicates.

---

## Per-section verdict

| Section | Verdict |
|---|---|
| **Farm Memory (`FarmBrain.ts`)** | **BUILT (read-only).** Composes existing crop/stage/scan/task/weather signals into one farm-state envelope. NOT a new datastore. `satelliteHistory` always `[]` (frozen) |
| Crop Stage Engine | ✅ **SHIPPED.** `AgronomyRuntime.__cropLifecycleHealth` (9-stage from crop + date). A `CropStageInferenceEngine.ts` would duplicate |
| Task Generator | ✅ **SHIPPED.** `scanToTask` + `ScanActionGenerator`/`ScanFollowUpGenerator` (#201) + daily-plan chain; already stage/scan-driven |
| Scan Memory (raise confidence) | ✅ **SHIPPED.** `ScanCandidateRanker` (+0.05 prev-scan) + `FarmScanContextRuntime` confidenceBoost (#200/#201) |
| Farm Health Score 0-100 | ✅ **SHIPPED.** `FarmHealthEngine.ts` (#194/#197), 4-tier band. (satellite-risk input declined — frozen) |
| **Satellite Correlation (Sentinel Hub)** | ⛔ **FROZEN — declined (3rd time).** Do-Not-Build list + founder #200/#206 calls. `satelliteUsed:false` gate-asserted; no Sentinel/NDVI import allowed |
| **Confidence Explainer (numeric)** | **BUILT (honest).** `buildConfidenceBreakdown` — image + farm-history slices that SUM to the shown %. NO satellite slice (would fabricate) |
| Automatic Insights (today's best action) | ✅ **SHIPPED.** RecommendationEngine / Today's Action Engine / CommandCenterDeck hero |
| **No Empty States** | **BUILT.** Home-hero "Today's Action" empty → `FarmBrain.nextRecommendedAction` (add crop → scan → start). (Activity feed already had guidance + CTAs since earlier) |

**Tally: 5 already ship · 1 frozen · 3 genuine honest deltas built.**

---

## Deltas built

### 1. `src/runtime/farmBrain/FarmBrain.ts` (read-only composite)
`buildFarmBrain()` → `{ farmId, crop, plantingDate, growthStage,
scanCount, taskCount, weatherKnown, satelliteHistory: [], hasCrop,
hasScan, hasActivity, isNew }`. Pure aggregator over signals the app
already holds — no new storage, no provider. `__farmBrainHealth`
asserts `readOnly`, `composesExistingHistories`, `satelliteUsed:false`.

### 2. Honest numeric confidence breakdown
`ScanConfidenceExplainer.buildConfidenceBreakdown({ confidencePct,
farmContextBoost })` → only the two contributors that genuinely
produced the number: **image evidence** (base) + **farm history**
(the explainable boost). They SUM to the displayed confidence. The
spec wanted a "Satellite 7%" line — that is **deliberately omitted**
because satellite contributes nothing here; printing it would
fabricate evidence. Surfaced in the scan card ("How sure we are").

### 3. No-empty-state Home hero
`FarmBrain.nextRecommendedAction(brain)` returns the single best
onboarding step. The Home hero's "Today's Action" card now shows
"Add your crop to get your first plan" / "Scan a plant to begin"
(+ a one-line guide) instead of a bare "Not enough data yet". Returns
null once a real action exists, so existing behavior is unchanged.

**KPI Impact (Founder Decision Rule):**
- Empty-state guidance → **Today's Action Started %** + activation:
  the first farmer's Home now points at the next step instead of a
  dead "Not enough data yet".
- Confidence breakdown → **Scan Success %** / trust: the farmer sees
  what the confidence is built from, honestly.

---

## Acceptance returns

**Architecture (text):**
```
existing signals (crop/stage/scan/task/weather)
        │
   buildFarmBrain ── satelliteHistory:[] (frozen)  ✗ no provider  ✗ no new store
        │
   ┌────┴───────────────┐
   ▼                    ▼
nextRecommendedAction   (scan card)
   │                buildConfidenceBreakdown ── image + farmHistory only
   ▼                    ▼                         ✗ no satellite slice
Home hero empty     "How sure we are" %
   state → next step
```

**Files added:** `src/runtime/farmBrain/FarmBrain.ts`,
`scripts/check-farm-brain.mjs`, this report.
**Files modified:** `ScanConfidenceExplainer.ts` (+breakdown),
`CommandCenterDeck.jsx` (empty-state next step),
`IntelligentScanResult.jsx` (breakdown render), `App.jsx` (boot
install), `package.json` (gate), `src/i18n/columns/*` (9 keys ×6).

**Database changes:** **None.** FarmBrain is read-only composition.

**API changes:** **None.** No endpoint, no provider, no satellite.

**Intelligence score:** Honestly — no model changed, so accuracy is
unchanged. What improved is **honesty + activation**: the confidence
is now itemized (only from real sources) and the empty Home points
to a next step. The frozen layers (satellite) cannot raise
"intelligence" pre-pilot without fabricating; the real unlock stays
**pilot users generating the histories FarmBrain is built to read.**
