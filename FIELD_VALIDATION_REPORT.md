# FIELD_VALIDATION_REPORT — v10

The golden-dataset harness (`npm run golden:dataset`) benchmarks accuracy after
every deploy and rejects a regression. v10 raises the target to **20,000+ verified
images** across continents / climates / crop types / growth stages / lighting /
camera qualities.

**Status: PENDING population.** Accuracy is never fabricated — the manifest ships
empty, so it reports PENDING (allowed). Populate `golden-dataset/manifest.json`
with verified images + ground truth, then run against the deployed app to record a
baseline; later runs that drop accuracy fail the check.

This is operator/field work; no accuracy or image count is invented here.
