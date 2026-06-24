# SCAN_PRODUCTION_CERTIFICATION.md

**Phase-1 Scan Certification** — Farroway. Date: 2026-06-24.
Basis: SCAN_ACCEPTANCE_TEST.md (10-test code-path verification) +
Plant.id auth fix (#221b) + i18n fix (this turn). build:safe green.

---

## Defect register

### 🔴 Critical (pilot blocker) — 0 open
- **[RESOLVED this turn] C1 — Primary scan card English-only in Twi.**
  65 `tSafe` keys on `IntelligentScanResult` / `ScanCommandCard` / legacy
  cards were unregistered in `T-en.js`, so the production scan result
  rendered English in Twi (and every non-English locale) — invisible to
  the parity gate. **Fixed:** 65 keys registered + translated (tw/fr/sw/ha/hi),
  parity 6634, new `check:scan-i18n-registered` gate prevents recurrence.
- **[RESOLVED #221b] C0 — Plant.id never authenticated** (env-var name
  mismatch `PLANT_API_KEY` vs `PLANT_ID_API_KEY`). Alias + diagnostics shipped.

### 🟠 High — 1 open
- **H1 — "Add plant" does not feed Farm Brain or the farm timeline (TEST 7).**
  `appendManagedPlant` writes only to `localStorage` and emits no event;
  `FarmBrain.ts` is a read-only composite with no `addCrop` writer; the
  `plant_created_from_scan` event isn't in `FarmTimeline.EVENT_TO_KIND`.
  Effect: the plant DOES save to My Plants with starter tasks, but the
  "Farm Brain receives crop / timeline updated" claims are unwired.
  *Not a crash or data-loss* → degraded, not a hard blocker. Remediation:
  emit a `plant_added`/`crop_added` pilot event from the managed-plant add
  path and pass managed plants as the `crop` signal into `getFarmBrain`.
  Deferred per `scanToManagedPlant.ts:230-239`. **Recommend: next sprint.**

### 🟡 Medium — 3 open
- **M1 — Production "Add to My Plants" bypasses the confidence-70 trust gate
  (TEST 1c).** The live button gates on catalog-membership eligibility
  (`scanToManagedPlant`), not `evaluateScanTrust`/conf≥70. The 70-gate is
  enforced only on `IntelligentScanResult`'s internal save button (inert in
  prod) + the legacy cards (not rendered). Decision needed: is catalog-match
  an acceptable save signal, or should conf≥70 also gate the live button?
  (Product call — not changed this turn to avoid blocking valid saves.)
- **M2 — Local scan-history list renders only date + category (TEST 10).**
  `UsefulScanHistory` stores thumbnail/plantName/confidence but renders
  neither; `RecentScansCard` (server-backed) shows all four. Remediation:
  render the stored fields in `UsefulScanHistory.jsx`.
- **M3 — ~38 pre-existing `scan.*` Twi values byte-identical to English.**
  Pass the non-blank parity gate but are untranslated (e.g. `scan.limitations`,
  `scan.action.*`, `scan.urgency.*`). Remediation: native Twi pass (program
  already exists — sprint #211).

### 🟢 Low — 2 open
- **L1 — New tw/ha translations (65 keys) are a machine-assisted first pass**
  pending native-speaker review (SCAN_I18N_TRANSLATOR_REVIEW.md). fr/sw are
  higher-confidence. No English leak (the test passes); quality review only.
- **L2 — `plants/` module renders lowercase `"Unknown plant"` fallback**
  (`PlantIntelligenceCard.jsx:94`, `AddPlantConfirmationCard.jsx:108`) —
  distinct from the banned scan label "Unknown Plant", outside the scan flow.
  Cosmetic; align to "Needs identification" for consistency.

---

## What is solid (PASS, no defect)
- Scan → identify → render (`scanDetectionEngine` + `IntelligentScanResult`).
- Save → persist → reopen round-trip (My Plants + scan history stores).
- Blurry / low-quality → friendly retake coach; **no "Unknown Plant", no
  technical error strings** ever reach the grower (gate-locked).
- Healthy result → explicit "Looks Healthy" status.
- Daily tasks generated from a confident scan (correctly confidence-gated).
- Voice narration of the result in the active locale (tw→Akan voice).
- Plant.id authenticated (#221b) with live diagnostics.

---

## FINAL VERDICT

# ✅ READY FOR PILOT

**Conditional, with one High defect (H1) tracked.**

Rationale: the core farmer loop — scan → identify → save → persist → hear
it back — works and is safe. The two pilot-critical blockers (Plant.id auth,
Twi English-leak on the primary card) are **fixed and gate-locked**. The
remaining High defect (Farm Brain / timeline ingestion) degrades a
follow-on feature but does not crash, lose data, or mislead the farmer —
the plant still saves with tasks. Pilots are precisely where the
runtime-dependent piece (real-photo identification accuracy) gets validated
with real farmers behind the now-working classifier.

**NOT YET "READY FOR FARMERS" (general availability).** Gate GA on:
1. Close **H1** (Farm Brain crop + timeline ingestion).
2. Resolve **M1** (save-gate policy) + **M2** (history fields) + **M3**
   (native Twi pass).
3. Confirm live identification in prod: one real scan +
   `GET /api/scan/diagnostics?live=1` → `providerConfigured:true`,
   `live.httpStatus:200`.

### Pilot entry checklist (do before onboarding Twi farmers)
- [ ] `GET /api/scan/diagnostics?live=1` returns `httpStatus:200` (key live).
- [ ] One real onion/maize/pepper scan returns a named plant + confidence.
- [ ] Switch app to Twi, open a scan result — confirm the new keys read Twi.
