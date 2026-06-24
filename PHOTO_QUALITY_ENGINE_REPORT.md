# PHOTO_QUALITY_ENGINE_REPORT.md

**Sprint #214 — photo quality engine.** Date: 2026-06-19.

## Model (honest, no new CV)

`evaluatePhotoQuality` composes the sub-signals the pipeline ALREADY
produces (`imageQuality.overall/leafCoverage/resolution/blur/...`). It
NEVER invents a sub-score: any signal we don't have stays `null`, and
`qualityScore` is the mean of ONLY the signals present. With no signal
at all, `measured:false` and the trust gate falls back to
confidence-based blocking.

Six sub-scores: blur · brightness · plantCoverage · focus ·
subjectCentered · imageResolution.

Thresholds: ≥75 pass · 50–74 caution · <50 fail. A failed photo sets
`confidenceCap:60` so a bad photo can't read as confident, and
`recommendedRetake:true`.

Coaching (i18n keys): moveCloser · useDaylight · avoidShadows ·
fillFrame · holdSteady · takeWholePlant — selected by which sub-score
fell below the caution line.

`PhotoQualityExplainer` turns the result into the coach card content
(title + what-went-wrong list + one "do this" instruction), all keyed.

## Health
`__photoQualityHealth()` → photoQualityReady, neverFabricatesSubScores,
passThreshold:75. Gate: `check:photo-quality-engine`.
