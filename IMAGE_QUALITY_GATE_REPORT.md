# IMAGE_QUALITY_GATE_REPORT

`ImageQualityGate.evaluateImageQuality(stats)` is the single quality decision point.
It composes the EXISTING `imageQualityPreflight` scorer (luminance + sharpness) —
not a re-implementation — and maps to the spec's 7 factors honestly.

## Factors
| Factor | Assessed today | Source |
|---|---|---|
| sharpness | ✅ real 0–100 | preflight Laplacian variance |
| brightness | ✅ real 0–100 | preflight mean luminance |
| resolution | ✅ real 0–100 | image width/height |
| distance | ◷ not_assessed | needs a CV detector |
| targetVisible | ◷ not_assessed | needs a CV detector |
| motionBlur | ◷ not_assessed | needs a CV detector |
| multipleObjects | ◷ not_assessed | needs a CV detector |

**Honesty:** the four CV-dependent factors return `score: null, assessed: false` —
never a fabricated number. The gate decision uses only the factors it can actually
measure.

## The gate (spec §5)
When a measured factor is below its floor (blurry / dark / washed-out / too small),
`overall: 'retake'` and **all three gates flip false**: `canDiagnose`,
`canIngestFarmBrain`, `canCreateTask` — plus a calm farmer retake hint. So a
low-quality image never produces a diagnosis, never updates FarmBrain, never creates
a task. Fails SAFE on any internal error (blocks + asks for a retake).

Thresholds mirror the preflight (luminance ∈ [0.18, 0.95], sharpness ≥ 0.30) + a
minimum 240px short side.
