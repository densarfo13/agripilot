# SCAN_INTELLIGENCE_V2_AUDIT.md

**Sprint #206 — "Mythos Scan Intelligence V2" audit + the one genuine delta.**
Date: 2026-06-19

This spec is the #200 spec re-sent as "V2." Its headline (Layer 2:
Sentinel Hub / satellite correlation) is on the **frozen list** and
was already ruled out by the founder in #200 ("Mythos only, no
satellite"). Per the Execution Policy I audited all 10 layers, built
the single genuine non-fabricating delta, and declined the rest with
reasons.

---

## Per-layer verdict

| Layer | Ask | Verdict |
|---|---|---|
| 1 Multi-photo / **evidence fusion** | leaf/plant/stem/soil → confidence + supporting + contradicting | **PARTIAL → BUILT.** MultiPhotoGuidance shipped #200; the missing piece — **contradicting observations** — is this sprint's delta (`ScanEvidenceFusionEngine.ts`) |
| 2 Satellite correlation (Sentinel Hub, NDVI/NDMI) | satelliteConfidence | ⛔ **FROZEN.** Do-Not-Build list + founder's #200 call. Declined. `satelliteContextBoost`/`satelliteUsed` hard-zeroed + gate-asserted |
| 3 Crop stage inference | seedling…harvest | ✅ **SHIPPED.** `AgronomyRuntime` `__cropLifecycleHealth` (9-stage). A new `CropStageInferenceEngine.ts` would duplicate |
| 4 Regional outbreak intelligence | outbreak probability across farms | ⛔ **DECLINED.** New cross-farm intelligence layer; "outbreak probability" with **zero pilot data** = fabrication. Frozen "new intelligence layer" until pilot metrics justify it |
| 5 Weather-disease correlation | risk adjustments | ◑ **PARTIAL (deferred).** Weather already feeds the scan `why`. A dedicated risk-adjustment engine edges toward disease-risk claims + has no data to calibrate pre-pilot. Deferred |
| 6 Scan memory | history + learn | ◑ **PARTIAL (deferred).** Outcome capture shipped (#198/#36). "Learn same farm/season" needs scans to remember — zero today. Deferred |
| 7 Confidence explainer | "Why 82%?" | ✅ **SHIPPED.** `ScanConfidenceExplainer.ts` (#200) builds the why list |
| 8 Task autogeneration | scan → tasks | ✅ **SHIPPED.** `scanToTask` + `ScanActionGenerator`/`ScanFollowUpGenerator` (#201) |
| 9 `FarmHealthEngine.ts` | 0-100 score | ✅ **SHIPPED.** File literally exists (#194/#197) with 4-tier band |
| 10 Execution safety | Low/Med/High + "Decision support, not a guarantee." | ✅ **SHIPPED.** Disclaimer keyed (`scanCommand.footnote`) + rendered; banned-wording gates (#198); confidence bands |

**Tally: 6.5 / 10 already ship · 2 frozen · 1 genuine delta built · 2 deferred (no pilot data).**

---

## The delta built — Layer 1 evidence fusion

`src/runtime/scanMythos/ScanEvidenceFusionEngine.ts` — `fuseScanEvidence()`
composes the already-produced `ScanMythosDecision` into a **two-sided**
evidence view:

- `supportingObservations[]` — reasons FOR (reuses the scrubbed `why`
  list + multi-photo agreement + clear candidate margin)
- **`contradictingObservations[]`** — the NEW honest value: reasons
  AGAINST. Close candidate margin → "Other plants look similar."
  Confidence < 60 → "The photo evidence is limited." Single photo →
  "Based on a single photo." High severity + low confidence →
  "Confirm before treating."
- `evidenceStrength`: strong / mixed / weak (honest synthesis)
- `fusedConfidence` **echoes** `decision.confidence` — never inflated

**Why this matters (Founder Decision Rule):** the card previously
showed only reasons FOR. Naming the doubts is honest decision support
→ improves **Scan Success %** (farmer trusts a tool that admits
uncertainty) and reduces acting on a wrong guess. Pure composition:
no provider call, no satellite, no fabrication.

KPI Impact: Scan Success % + trust → D7 retention. Additive; the
gate-locked identification card is untouched.

### Bonus fix
`mythosDecision` was assigned as a bare Promise (never awaited), so
#201's "Why we think this" UI section silently rendered empty. Both
`mythosDecision` and the new `evidenceFusion` are now awaited before
the frozen result — so the #201 section works too.

---

## Files

Added: `src/runtime/scanMythos/ScanEvidenceFusionEngine.ts`,
`scripts/check-scan-evidence-fusion.mjs`, this report.
Modified: `src/core/scanDetectionEngine.js` (await + `evidenceFusion`),
`src/components/scan/IntelligentScanResult.jsx` (contradicting list),
`src/App.jsx` (boot install), `package.json` (gate wired),
`src/i18n/columns/*` (`scan.evidence.against` ×6).

## Architecture (text diagram)

```
photo → scanApiService → envelope (plant, candidates, confidence, issue)
                              │
              composeScanMythosDecision (#200/#201)
                              │  decision { why, limitations, confidence, candidates, severity }
                              ▼
              fuseScanEvidence (#206)  ── echoes confidence (never inflates)
                              │           ✗ no satellite  ✗ no provider  ✗ no fabrication
                              ▼
        evidenceFusion { supporting[], CONTRADICTING[], evidenceStrength }
                              │
              IntelligentScanResult → "What could change this" section
```

## Database changes
**None.** Composition only — no schema, no migration.

## API changes
**None.** Reads the existing scan envelope; no new endpoint, no provider.

## Build status
`build:safe` — new gate `check:scan-evidence-fusion` wired; full run green (see commit).

## Intelligence score improvement
Honest framing: this does not raise a model's accuracy (no model
changed). It raises **decision honesty** — the scan now states what
argues against its own guess, which is the trust dimension the V2
spec was reaching for. The frozen layers (satellite, regional
outbreak) cannot improve "intelligence" pre-pilot because they have
no data; building them would fabricate. The real intelligence unlock
remains **pilot users generating scans + outcomes** to learn from.
