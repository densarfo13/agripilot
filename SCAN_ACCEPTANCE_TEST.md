# SCAN_ACCEPTANCE_TEST.md

**Phase-1 Scan Acceptance Test** — Farroway production readiness validation.
Date: 2026-06-24. Method: static code-path verification (4 parallel
sub-audits) + gate evidence. Plant.id authentication issue is closed (#221b).

## Honesty note on method
This is a **code-path acceptance test**, not a live device run. I verified
the wiring, persistence, gating, i18n, voice, and history *shape* that make
each test pass, plus existing gate evidence. Anything that requires a live
device + real photo + the now-authenticated Plant.id call (e.g. the literal
species returned for a specific onion photo) is marked **WARNING — runtime**
with the exact production check to confirm it, rather than claimed as
observed. A real certification names what it did and did not execute.

---

## Results

### TEST 1 — Scan onion leaf → identified, confidence > 70%, saved to My Plants
**PASS** (code path) · **WARNING — runtime** (live species value)
- Envelope carries `plantName` + numeric `confidencePct` — `scanDetectionEngine.js:291-294,318-352`.
- Production card `IntelligentScanResult` renders plant + `{confidencePct}% sure` — `:386-414`.
- Save → `AddPlantConfirmationCard` "Add to My Plants" → `ScanPage onAdd` → `appendManagedPlant` → `localStorage['farroway_managed_plants']` — `managedPlantsStore.js:80-91`.
- Confidence-70 trust gate exists — `ScanTrustGate.ts:53,70-74` (threshold `ScanTrustContracts.ts:15`).
- WARNING: the live "Add to My Plants" button gates on **catalog eligibility**, not the 70-gate (see Medium defect M1). The actual onion species + % is runtime-dependent — confirm with one prod scan + `GET /api/scan/diagnostics?live=1` (httpStatus 200).

### TEST 2 — Scan maize leaf → identified, saved to farm
**PASS** (code path) · **WARNING — runtime** — same path as TEST 1; maize is a core catalog crop so `_scanToManagedPlant` eligibility resolves. Live identification runtime-dependent.

### TEST 3 — Scan pepper plant → identified, daily tasks generated
**PASS** (with WARNING) — `addScanTasks()` persists to `farroway_scan_tasks` and publishes `TASK_CREATED` (`scanToTask.js:102-211`); `dailyIntelligenceEngine.js:369-392` merges them into Today's Plan (consumed by `DailyPlanCard`, `VoiceAssistant`, `DailyBriefingCard`). WARNING: task generation is correctly gated on `canCreateTask` (confidence ≥ 70 + known issue) + the `FEATURE_SCAN_TASK_SUGGESTION` flag — a low-confidence scan deliberately produces no task (sprint #220).

### TEST 4 — Scan healthy leaf → health status shown
**PASS** — `GUIDANCE.healthy` → label "Looks Healthy" + "Your crop appears healthy. No obvious issues detected." (`UsefulResultCard.jsx:52-70,624-669`); positive status mirrored in `ScanComparison`, `UsefulScanHistory`, `TreatmentGuidanceCard` (suppresses treatment on healthy).

### TEST 5 — Scan blurry image → friendly retry, NO "Unknown Plant", NO technical errors
**PASS** (all three) —
- Blurry → `PhotoQualityEngine.ts:70-91` (`failed`, `recommendedRetake`, `confidenceCap=60`) → trust blocks (`ScanTrustGate.ts:64,73`) → photo-coach card "Photo needs a clearer view" + Retake/Upload/Save-for-review (`IntelligentScanResult.jsx:920-960`).
- **"Unknown Plant" cannot render**: all 14 src hits are comments / lowercase detection tokens / doc strings; the fallback ladder resolves to "Needs confirmation"/"Scan unclear"/"Needs Identification" — never "Unknown Plant".
- **No technical errors**: banned "Camera ran into a problem" appears only in 3 comments (zero rendered); camera/provider failures map to friendly copy ("Camera is not available right now. Upload a photo instead.").
- Unidentified path shows explanation + no Create Task (`canCreateTask` gate, `useful-result-unidentified`).

### TEST 6 — Save scan result → reopen → verify persistence
**PASS** — two stores round-trip: My Plants `farroway_managed_plants` (`managedPlantsStore.js:40-91`, read on `MyPlants.jsx:133`) and scan history `farroway_scan_history_v1` (`scanHistoryStore.js:43-282`, re-read by id on `ScanResultPage.jsx:93-96`). Both read back from the same key on init; corrupt JSON → `[]`.

### TEST 7 — Add identified plant → Farm Brain receives crop + timeline updated + tasks generated
**FAIL** (2 of 3 sub-criteria) —
- (a) **FAIL** — FarmBrain does NOT receive the crop. `FarmBrain.ts:1-18` is a READ-ONLY composite ("NOT a new datastore"); there is no `addCrop` writer; the plant goes only to the disconnected `managedPlantsStore`.
- (b) **FAIL** — no farm-timeline entry. `appendManagedPlant` emits no event; ScanPage emits `trackEvent('plant_created_from_scan')`, which is NOT in `FarmTimeline.ts` `EVENT_TO_KIND:40-50`, so the timeline never sees it.
- (c) **PASS (partial)** — `scanToManagedPlant.ts:195-203` attaches starter tasks to `plant.tasks` + a `tasks_generated` history entry, but on the per-plant record, NOT the farm-wide Today's-Plan slot.
- Matches the deferred-wiring note at `scanToManagedPlant.ts:230-239` ("ScanPage UI bridge sits in the next sprint"). → **High defect H1.**

### TEST 8 — Twi language → no English leakage, no untranslated keys
**WAS FAIL → FIXED this turn** —
- Discovered: **65 scan keys** the production cards call via `tSafe(...)` were **never registered** in `T-en.js` (`scan.intel.*` ×37 on `IntelligentScanResult`, `scanCommand.*` ×10 on `ScanCommandCard`, plus 18 on the legacy cards). `tSafe` returns the English default for an unregistered key, so the **primary scan result rendered English in Twi** — and the parity gate couldn't see it (it only checks keys that exist in `T-en`).
- Fixed: all 65 registered in `T-en.js` + translated into tw/fr/sw/ha/hi (parity 6634, `check:translations` PASS). New gate `check:scan-i18n-registered` fails the build if any scan-card `tSafe` key is unregistered (closes the blind spot).
- **WARNING — residual**: (1) the new tw/ha translations are a machine-assisted first pass pending native review (see SCAN_I18N_TRANSLATOR_REVIEW.md); (2) ~38 *pre-existing* `scan.*` Twi values are byte-identical to English (pass the non-blank gate but are untranslated) → Medium defect M3.

### TEST 9 — Voice playback → result narration works
**PASS** — Listen button `scan-voice-listen` (`IntelligentScanResult.jsx:372`) → `_buildSpokenSummary(result)` (`:615-641`) → `speakText(text, lang)` → `speakBrowserTTS` with `LANG_TAGS` mapping `tw→'ak'` (Akan) and English-voice fallback (`voiceService.js:63-94`). Narrates plant + severity + issue + first action in the active locale.

### TEST 10 — Scan history → thumbnail, plant name, date, confidence
**WARNING** —
- `RecentScansCard` (server-backed `/api/scan/history`): **all 4 present** — thumbnail/name/date/confidence (`:126-141`).
- `UsefulScanHistory` (local `farroway_scan_history_v1`): renders **date + category only**; thumbnail, plant name, and confidence ARE stored (`scanHistoryStore.js:201-223`) but not rendered. → Medium defect M2.

---

## Verdict tally
| Test | Verdict |
|------|---------|
| 1 Onion → identify + save | PASS / WARNING(runtime) |
| 2 Maize → identify + save | PASS / WARNING(runtime) |
| 3 Pepper → tasks | PASS (gated, correct) |
| 4 Healthy → status | **PASS** |
| 5 Blurry → safe retry | **PASS** |
| 6 Persistence | **PASS** |
| 7 Farm Brain + timeline + tasks | **FAIL** (a,b) / partial (c) |
| 8 Twi no English leak | FIXED this turn → PASS / WARNING(review) |
| 9 Voice narration | **PASS** |
| 10 History shape | **WARNING** |

Full defect tiering + go/no-go in **SCAN_PRODUCTION_CERTIFICATION.md**.
