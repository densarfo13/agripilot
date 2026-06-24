# FARM_BRAIN_RUNTIME_V2

**Every scan result passes through FarmBrain. No bypass path.** Sprint #229.

## Flow

```
  Scan Result ──► _withFarmBrain() ──► FarmBrain ──► result.farmBrain {
                  (scanDetectionEngine)               riskScore
                                                      confidenceScore
                                                      diseaseLikelihood
                                                      growthStage
                                                      nextAction
                                                      followUpTask
                                                    }
```

## No bypass — the single chokepoint

`scanDetectionEngine.analyzeScan` has **two** result exits, and BOTH are
returned through `_withFarmBrain()`:
1. the API result (`_result`) → `_withFarmBrain(_result, input)`
2. the rule fallback → `_withFarmBrain(getRuleBasedFallback(input), input)`

There is no code path that returns a scan result without `result.farmBrain`
attached. `check:farm-brain-v2` fails the build if a bare `return _result`
or `return getRuleBasedFallback(...)` is ever reintroduced.

## What FarmBrain generates (composition, not new ML)

`runFarmBrainV2(scanResult, context)` derives each field from the scan
envelope the engine already built plus the existing `CropStageEngine`:

| Field | Derived from | Honest-null when |
|---|---|---|
| **confidenceScore** (0–100) | `confidencePct`, else band (high 85 / medium 55 / low 25) | no confidence signal |
| **diseaseLikelihood** (0–100) | provider disease-candidate score; healthy → 5; named issue → confidence proxy | unidentified / unclear |
| **riskScore** (0–100) | `diseaseLikelihood × severityWeight` (severity high/med/low) | no disease signal |
| **growthStage** | `result.growthStage`, else `inferCropStage(crop, plantingDate)` | stage unknown |
| **nextAction** | mythos decision → recommendedActions → suggestedTasks | none present |
| **followUpTask** | mythos follow-up → a suggested follow-up task | none present |

Every field returns **null** when its inputs are absent — FarmBrain never
fabricates a score (consistent with the standing no-fabrication doctrine).
A `trace.inputs[]` records which signals fed each run, for explainability.

## Properties

- **Pure, frozen, never throws** — a composition error returns an
  all-null envelope, so it can never break a scan result.
- **Additive** — the scan result still carries every existing field; this
  only *adds* `result.farmBrain`. UI surfaces can read the canonical
  decision from one place going forward.

## V2 boundary

`diseaseLikelihood` uses the identification confidence as a documented
proxy when the provider returns no explicit disease score — it is a
composition signal, not a calibrated probability. A calibrated likelihood
model is a future V3 and would slot in behind the same `runFarmBrainV2`
entry point without changing any caller.
