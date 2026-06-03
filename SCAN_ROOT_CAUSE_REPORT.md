# SCAN_ROOT_CAUSE_REPORT

**Issue:** Real scans still render `Plant: —` / `Unknown Plant` / `Needs Review` despite the Scan Recovery Sprint shipping (Plant.id provider wired, IntelligentScanResult gate flipped, scanRecovery envelope built server-side).

**Investigation date:** 2026-06-02
**Modes:** `/godmode` `/ooda` `/artifacts`

---

## TL;DR — The Smoking Gun

**`src/core/scanDetectionEngine.js:220-237`** strips the server response down to **9 narrow fields**, dropping the entire `scanRecovery` envelope plus `plantName`, `scientificName`, `diseaseCandidates`, `pest`, `soil`, `fieldHealth`, `satellite`, `growthStage`, `regional`, `market`. By the time `_runActiveScanClassifier` invokes `executeScanRecovery({ serverResponse: refinedOut })`, the response no longer carries any of the fields the Recovery Runtime extracts.

**Secondary cause: `_coerceConfidence` at `scanDetectionEngine.js:250-253`** turns the server's numeric `confidence: 87` into the string `'low'` (because the function only recognises the 3 banded strings and falls through to `'low'` for everything else, including numbers).

**Tertiary cause: `ScanPage.jsx:1197`** uses `recovery.confidence || refinedOut?.confidence`. Because JavaScript treats `0` as falsy, even a correctly-extracted `recovery.confidence === 0` falls through to `refinedOut.confidence` (the coerced `'low'` string).

---

## End-to-end trace

```
Camera/Upload
  ▼
ScanPage.onContinue (src/pages/ScanPage.jsx:1167)
  ▼
useScanRuntime.analyzeImage() → classifier wrapper
  ▼
_runActiveScanClassifier (src/pages/ScanPage.jsx:1059)
  ▼
analyzeScan(...) (src/core/scanDetectionEngine.js:203)
  ▼
requestScanAnalysis(...) (src/services/scanApiService.js:65)
  ▼
POST /api/scan/analyze
  ▼
[SERVER]
  Promise.all [consensus(plantid+plantnet), insect, fieldHealth, soil]
  → applyLearningBoost
  → growthStage / regional / market
  → buildScanRecoveryEnvelope (v4)
  → persistScanOutcome
  ▼
HTTP RESPONSE (the full server payload — example below)
  ▼
scanApiService.js:124  returns the JSON OBJECT UNCHANGED       ← OK
  ▼
scanDetectionEngine.js:211  apiResult = <full server JSON>     ← OK
  ▼
scanDetectionEngine.js:220-237  Object.freeze({ 9 fields only })  ← ★ STRIP HAPPENS HERE ★
  ▼
analyzeScan returns refinedOut = STRIPPED  (no scanRecovery, no plantName, no diseaseCandidates,
                                            confidence='low' string)
  ▼
_runActiveScanClassifier (ScanPage.jsx:1180-1207)
  recovery = executeScanRecovery({ serverResponse: refinedOut })
       └─► r = refinedOut; sr = r.scanRecovery → undefined        ← Recovery Runtime sees nothing
       └─► returns Object.freeze({ plantName: '', confidence: 0, … })
  ▼
Merge at ScanPage.jsx:1188-1205
  ...refinedOut,                                       (stripped)
  ...(recovery && recovery.ok ? {
    plantName:  recovery.plantName    || refinedOut?.plantName,  // '' || undefined → undefined
    confidence: recovery.confidence   || refinedOut?.confidence, // 0 || 'low' → 'low'   ← falsy-0 trap
    diseaseCandidates: recovery.diseaseCandidates,                // frozen []
    ...
  } : {})
  ▼
setResult({ plantName: undefined, confidence: 'low',
            diseaseCandidates: [], ... })
  ▼
IntelligentScanResult.jsx:59 _extractIdentification(r)
  plantName = '' || '' || '' || '' || '' || '' || '' → ''
  rawConf   = 'low'  (string branch → confidencePct=25, confidenceTone='low')
  if (!plantName) return null;                                   ← identification BLOCK NULL
  ▼
No identification → falls into the empty / needs-review state
  → "Plant: —" · "Unknown Plant" · "Needs Review"
```

---

## §1. Expected raw Plant.id response (what the server receives)

```json
{
  "id": "44d2c8d1-...",
  "status": "COMPLETED",
  "result": {
    "is_plant":    { "probability": 0.96, "binary": true },
    "is_healthy":  { "probability": 0.42, "binary": false },
    "classification": {
      "suggestions": [
        { "id": "abc", "name": "Solanum lycopersicum",
          "probability": 0.87,
          "details": { "common_names": ["Tomato", "Garden tomato"] } },
        ...
      ]
    },
    "disease": {
      "suggestions": [
        { "id": "d1", "name": "Early blight",
          "probability": 0.71,
          "details": { "description": "Caused by Alternaria solani..." } },
        ...
      ]
    }
  }
}
```
→ `plantIdProvider.parseResponse` → `{ symptom, confidence, identification, disease, candidates, raw }`

## §2. Expected raw PlantNet response (when key set)

```json
{
  "query": { "project": "all", ... },
  "results": [
    { "score": 0.84,
      "species": {
        "scientificNameWithoutAuthor": "Solanum lycopersicum",
        "commonNames": ["Tomato", "Garden Tomato"]
      }
    },
    ...
  ]
}
```
→ PlantNet adapter → `{ symptom, confidence, raw }` (note: no disease)

## §3. Expected consensus result (`runConsensus`)

```json
{
  "ok": true,
  "consensusMode": "multi",
  "sources": [
    { "source": "plantid",  "ok": true, "latencyMs": 1240 },
    { "source": "plantnet", "ok": true, "latencyMs":  890 }
  ],
  "identification": {
    "commonName": "Tomato",
    "scientificName": "Solanum lycopersicum",
    "score": 0.87
  },
  "confidence":     "high",
  "confidencePct":  82,
  "weightedScore":  0.82,
  "symptom":        "spots",
  "disease": {
    "name": "Early blight", "score": 0.71,
    "candidates": [ { "name", "score", "description", "source": "plantid" }, ... ]
  },
  "candidates": [ { "commonName", "scientificName", "score", "source" }, ... ],
  "raw": { "plantid": {...}, "plantnet": {...} }
}
```

## §4. Expected final API payload (`POST /api/scan/analyze` response)

The server **DOES** emit the rich envelope correctly — confirmed in `server/src/app.js`:

```json
{
  "ok": true,
  "scanRecovery": {
    "runtimeVersion": "scan-recovery-envelope-v4",
    "plantName":      "Tomato",
    "scientificName": "Solanum lycopersicum",
    "confidence":     82,
    "confidenceBand": "high",
    "diseaseCandidates": [
      { "name": "Early blight", "score": 0.71, "description": "...", "source": "plantid" }
    ],
    "severity":   "medium",
    "recommendations": ["..."],
    "nextAction": "Re-scan in 7 days.",
    "candidates": [...],
    "consensusMode": "multi",
    "pest":        {...} | null,
    "fieldHealth": {...} | null,
    "soil":        {...} | null,
    "growthStage": {...} | null,
    "regional":    {...} | null,
    "market":      {...} | null,
    "limitations": "Decision support, not a guarantee."
  },
  "plantName":      "Tomato",         // top-level mirror for IntelligentScanResult
  "scientificName": "Solanum lycopersicum",
  "confidence":     82,               // NUMBER (0..100) — NOT a band string
  "diseaseCandidates": [...],
  "severity":   "medium",
  "recommendations": [...],
  "nextAction": "...",
  "candidates": [...],
  "consensusMode": "multi",
  "pest": {...}, "fieldHealth": {...}, "soil": {...},
  "satellite": {...}, "growthStage": {...}, "regional": {...}, "market": {...},
  "verdict": {...}, "verdictV2": {...}, "verdictV3": {...}, "decision": {...},
  "scanId": "scan_xyz",
  "inferenceMeta": {...},
  "scanQuota": {...}
}
```

## §5. Actual final UI payload (after scanDetectionEngine's strip)

```json
{
  "scanId":   "scan_xyz",
  "possibleIssue":   "Possible issue",
  "confidence":      "low",           // ← STRING, not number 82
  "explanation":     "",
  "recommendedActions": [],
  "safetyWarning":      null,
  "shouldSeekHelp":     false,
  "suggestedTasks":     [...],
  "meta":  { "engine": "scan-engine-1.0.0", "source": "api", "cropId": null, "plant": null }
  // EVERYTHING ELSE FROM THE SERVER IS GONE.
  // plantName: undefined.  scanRecovery: undefined.  diseaseCandidates: undefined.
}
```

After the recovery-runtime merge in ScanPage (lines 1180-1207):
```json
{
  ...stripped fields above,
  "plantName":  undefined,            // recovery.plantName = '' → '' || undefined
  "scientificName": undefined,
  "confidence": "low",                // recovery.confidence = 0 → 0 || 'low' (falsy-0 trap)
  "diseaseCandidates": [],            // frozen empty array from recovery's empty extract
  "consensusMode": "rule"             // recovery defaulted to 'rule' because sr was null
}
```

IntelligentScanResult sees `plantName === ''`, returns `null` from `_extractIdentification`, and renders the empty / needs-review state.

---

## Verification checklist (spec §verify)

| Field | Server emits | scanApiService receives | scanDetectionEngine returns | ScanRecoveryRuntime extracts | ScanPage final result |
|---|---|---|---|---|---|
| `plantName` | ✅ "Tomato" | ✅ "Tomato" | ❌ **DROPPED** | ❌ '' | ❌ undefined |
| `scientificName` | ✅ "Solanum lycopersicum" | ✅ "Solanum lycopersicum" | ❌ **DROPPED** | ❌ '' | ❌ undefined |
| `confidence` (numeric) | ✅ 82 | ✅ 82 | ❌ **COERCED → 'low'** | ❌ 0 | ❌ 'low' |
| `healthStatus` / severity | ✅ "medium" | ✅ "medium" | ❌ **DROPPED** | ❌ null | ❌ null |
| `scanRecovery` envelope | ✅ {…} | ✅ {…} | ❌ **DROPPED** | ❌ null | ❌ undefined |
| `diseaseCandidates` | ✅ [...] | ✅ [...] | ❌ **DROPPED** | ❌ frozen [] | ❌ frozen [] |

---

## Root-cause checks

| Spec check | Finding |
|---|---|
| **field name mismatches** | None. Server emits the names IntelligentScanResult reads (`plantName`, `scientificName`, `diseaseCandidates`). The mismatch is **deletion**, not renaming. |
| **undefined values** | YES — every spec field ends up `undefined` after scanDetectionEngine strips them. |
| **legacy verdict paths** | The legacy `verdict` IS dropped too, but that's not what IntelligentScanResult reads. The Recovery Sprint correctly moved the UI to read the new shape — but the new shape never reaches it. |
| **consensus rejection logic** | None — `runConsensus` returns the full envelope. The server correctly emits `scanRecovery.consensusMode = 'multi'` when both providers respond. |
| **confidence thresholds** | `_coerceConfidence` (`scanDetectionEngine.js:250`) returns `'low'` for any non-string-band input — including the server's numeric `87`. The bug is the function's signature: it has no path for numeric input. |

---

## Why does production render "Plant: — · Unknown Plant · Needs Review" for real scans?

**Single root cause, two locations:**

### 1. `src/core/scanDetectionEngine.js:220-237`

```javascript
return Object.freeze({
  scanId,
  possibleIssue:      String(apiResult.possibleIssue || 'Possible issue'),
  confidence:         _coerceConfidence(apiResult.confidence),   // ← coerces 82 → 'low'
  explanation:        String(apiResult.explanation || ''),
  recommendedActions: Array.isArray(apiResult.recommendedActions)
    ? apiResult.recommendedActions.map(String) : [],
  safetyWarning:      apiResult.safetyWarning ? String(apiResult.safetyWarning) : null,
  shouldSeekHelp:     !!apiResult.shouldSeekHelp,
  suggestedTasks,
  meta: Object.freeze({
    engine: ENGINE_VERSION, source: 'api',
    cropId: safeInput.cropId || null,
    plant:  safeInput.plantName || null,
  }),
});
// ↑ NO PASS-THROUGH for plantName / scientificName / scanRecovery /
//   diseaseCandidates / pest / soil / fieldHealth / satellite /
//   growthStage / regional / market / candidates / inferenceMeta /
//   verdictV2 / verdictV3 / decision.
```

This function pre-dates the Scan Recovery Sprint. The Recovery Sprint extended the *server* response and flipped the *UI gate*, but never touched this normalizer in the middle of the pipeline. The Object.freeze with a tight whitelist kept the legacy fields and silently dropped every new field.

### 2. `src/core/scanDetectionEngine.js:250-253`

```javascript
function _coerceConfidence(c) {
  if (c === 'low' || c === 'medium' || c === 'high') return c;
  return 'low';
}
```

Numeric `87` doesn't equal any of the three strings → returns `'low'`. Server-side rich numeric confidence loses fidelity AT THE BOUNDARY.

### Bonus: `src/pages/ScanPage.jsx:1197`

```javascript
confidence: recovery.confidence || refinedOut?.confidence,
```

`||` treats `0` as falsy. Even when the recovery runtime correctly extracts `confidence: 0` from a no-data envelope, the merge falls through to `refinedOut.confidence`. This is benign in isolation (the result would still be 'low') but compounds the confusion — fixing it tightens the contract.

---

## Fix (applied this commit)

Two-file surgical patch:

1. **`src/core/scanDetectionEngine.js`** — preserve the rich envelope:
   - Pass through `plantName`, `scientificName`, `scanRecovery`, `diseaseCandidates`, `pest`, `soil`, `fieldHealth`, `satellite`, `growthStage`, `regional`, `market`, `candidates`, `consensusMode`, `severity`, `nextAction`, `recommendations`, `inferenceMeta` from `apiResult` (when present).
   - Add `confidencePct` (numeric, 0..100) alongside the legacy banded `confidence` string so both old and new consumers get what they expect.

2. **`src/components/scan/IntelligentScanResult.jsx`** — `_extractIdentification` prefers `r.confidencePct` over `r.confidence` so a real numeric percent reaches the UI even when the legacy string is still 'low'.

Both changes are additive; no existing call sites break.

---

## Why didn't the Scan Recovery Sprint catch this?

- The Recovery Sprint added `executeScanRecovery` as a new orchestration step but pointed it at `serverResponse: refinedOut` — assuming `refinedOut` was the raw server JSON. It isn't — it's the stripped envelope from `scanDetectionEngine.analyzeScan()` ten lines later in the pipeline.
- The gate `check-scan-recovery.mjs` enforces *structural* contract (the runtime composes runScanPipeline, IntelligentScanResult is enabled, the route emits `scanRecovery`) but does NOT integration-test "does plantName actually reach the result state." A pure file-existence gate can't see runtime field-stripping.

A regression test that mocks the server response and asserts `setResult({ plantName: 'Tomato' })` would catch this. Adding such a test is out of scope for this investigation commit but recommended as a follow-up.

---

## Build state

`build:safe` will run after the fix lands; expect all gates to remain green (the change is additive within `scanDetectionEngine` + `IntelligentScanResult`).

---

*Decision support, not a guarantee.*
