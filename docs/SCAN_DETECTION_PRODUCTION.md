# Farroway — Scan Detection Production Fix

Makes Scan detection production-grade, honest, explainable, and wired into the
intelligence loop — **without** touching the safe-shell, iOS-camera, or
upload-primary invariants. Detection is composition + a canonical contract +
governance gates; the live scan render path is unchanged.

> Every detection carries a confidence + limitations. If unknown, we say
> unknown. **Decision support, not a guarantee.**

---

## 1. Production summary
A canonical detection contract + a pure provider normalizer + three read-only
health probes (`__scanDetectionHealth`, `__scanOODAHealth`,
`__scanArtifactHealth`) now formalize how any provider result becomes an
honest, localized, explainable detection — with confidence thresholds,
needsReview, and a forbidden-overclaim policy enforced by 5 new gates.

## 2. Files created
- `src/runtime/scan/scanDetectionContracts.ts` — canonical contract: category
  vocabularies (plant/health/disease/pest/nutrient/growth/harvest), confidence
  thresholds (0.75 / 0.45), artifact idempotency-key builders, banned-words
  policy, disclaimer.
- `src/runtime/scan/ScanDetectionNormalizer.ts` — `normalizeDetection()` +
  `buildScanTaskCandidates()`.
- `src/runtime/scan/ScanDetectionRuntime.ts` — installs the 3 health probes.
- `scripts/check-scan-detection-contract.mjs`, `check-scan-normalizer.mjs`,
  `check-scan-result-safety.mjs`, `check-scan-ooda-artifacts.mjs`,
  `check-scan-task-safety.mjs`.
- `docs/SCAN_DETECTION_PRODUCTION.md`.

## 3. Files modified
- `src/runtime/scan/ScanAnalysisRuntime.ts` — re-exports the canonical
  contract + normalizer (the analysis module now exposes the full contract).
- `src/App.jsx` — boot-installs the detection probes (try/catch; never blocks
  boot or the scan render).
- `package.json` — 5 gates wired into `build:safe`.

## 4. Detection contract summary
Canonical envelope: `scanId, imageSource, provider, detectedAt, primary
{type, canonicalKey, displayName, scientificName, confidence}, health {status,
score, confidence}, diseases[], pests[], nutrients[], growthStage,
harvestReadiness, overallConfidence, needsReview, limitations, rawProviderRef`.
Vocabularies cover the full §3 disease (14), pest (13), nutrient (9) sets +
plant types, health statuses, growth stages, harvest statuses. `rawProviderRef`
is an internal pointer — never rendered to the grower.

## 5. Normalizer summary
`normalizeDetection(raw, {locale})` maps any provider (Plant.id / PlantNet /
Crop.id / local catalog / manual review) into the contract: localizes every
label through `translateEntityLabel()` (English fallback + translatorReview
flag when missing), buckets issues into disease/pest/nutrient by canonical
catalog match, computes per-item + overall confidence via the contract tiers
(≥0.75 high; 0.45–0.74 needsReview; <0.45 unknown+needsReview), attaches
limitations, and never surfaces raw JSON.

## 6. Result UI safety summary
`ScanResultCard` already renders farmer-friendly copy with safe wording
(Likely / Possible / Needs review / Not enough information), no raw JSON, and
a "results are not guaranteed" disclaimer. The new `check-scan-result-safety`
gate locks this: it fails on a positive "guaranteed" / "confirmed <diagnosis>"
/ "100% accurate" claim or any raw provider/detection JSON in the result UI,
while allowing the user-action confirm flow and the disclaimer.

## 7. Task generation summary
`buildScanTaskCandidates(detection)` produces localized, safe candidates —
inspect-nearby / follow-up-scan for disease, inspect-leaf-underside for pest,
check-soil for nutrient, harvest-check for readiness. Every candidate is
`vettedTreatment:false, dosage:null` — no chemical dosage, no auto-prescribed
treatment (a treatment task is allowed only when a vetted catalog supplies it).

## 8. OODA integration summary
`__scanOODAHealth()` → `observeDetectionReady`, `orientKnowledgeReady`,
`decideRecommendationReady`, `actTaskReady`, `nonBlocking:true`,
`failureSafe:true`. Detection composes into OODA after the result; OODA never
blocks the render and a failure is non-fatal.

## 9. Artifact integration summary
`__scanArtifactHealth()` → the 9 scan events (ScanStarted/ScanCompleted/
ScanFailed/DiagnosisCreated/RecommendationCreated/TaskCreatedFromScan/
PlantCreatedFromScan/FollowUpScanRequested/OutcomeFollowUpRequested),
the idempotency key formats (`scan:start:{imageHash}`, `scan:complete:{scanId}`,
`scan:failed:{scanId}`, `task:from-scan:{scanId}:{taskType}`),
`artifactRuntimeOnly:true`, `offlineSafe`, `nonBlocking`, `failureSafe`.

## 10. Localization summary
All detection labels (crop / disease / pest / nutrient names, and task text)
route through `translateEntityLabel(type, key, locale)` → localized label +
`fallbackUsed`/`reviewRequired`. Missing translations fall back to English and
record the missing key for the translator-review queue. No fabricated
non-English agronomy terms.

## 11. Governance checks added (wired into `build:safe`, all PASS)
`check-scan-detection-contract`, `check-scan-normalizer`,
`check-scan-result-safety`, `check-scan-ooda-artifacts`,
`check-scan-task-safety`.

## 12. Build results
`npm run build:safe` runs the full gate chain (incl. the 5 new gates) + vite
build. See the build log / commit for the green run.

## 13. Final scan detection verdict
Detection is now contract-bound, honest, explainable, localized, and
gate-locked: no overclaims, no raw JSON to growers, no unsafe chemical advice,
no fabricated soil/satellite data, confidence + limitations on every output,
and non-blocking OODA + artifact wiring. The scan safe-shell, iOS-camera, and
upload-primary invariants are untouched. `window.__scanDetectionHealth()`
reports the layer ready.
