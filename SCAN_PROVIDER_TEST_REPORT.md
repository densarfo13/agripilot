# SCAN_PROVIDER_TEST_REPORT

## Automated checks (run on every build)
- `check:scan-provider-adapters` — adapters exist, read the correct env names,
  carry the full status taxonomy, are best-effort (probe proves no-key →
  UNSUPPORTED, no throw), mushroom never fabricates "edible", and both are wired
  into the analyze pipeline. **PASS.**
- `check:provider-runtime-status` — keyed provider is never `missing_env`. **PASS.**

## 20 live scans (§ "Run 20 live scans")
Harness built: `npm run scan:provider-test` (`scripts/run-provider-scan-test.mjs`)
— POSTs 20 images to the deployed `/api/scan/analyze` and tallies each scan's
`providerStatuses` per provider (plantId / cropHealth / insectId / mushroom).

**It does NOT fabricate results.** From this build environment there are no
provider keys, no live API, and no images, so a real 20-scan run cannot be
executed here. The harness reports `LIVE RUN PENDING` until run against Railway:

```
SCAN_API_BASE=https://<railway-app> SCAN_API_TOKEN=<admin> \
SCAN_IMAGE_DIR=./imgs node scripts/run-provider-scan-test.mjs
```

Each scan row prints the real per-provider status; the summary tallies how many
of the 20 returned READY / AUTH_FAILED / RATE_LIMITED / NO_RESULT / UNSUPPORTED
per provider. That is the honest acceptance evidence — produced by the live run,
not asserted here.

## What to expect on Railway, per provider
- **plant.id** — keyed + wired → READY (or AUTH_FAILED if the key is wrong).
- **insect.id** — keyed + wired → READY on insect photos.
- **crop.health** — NOW wired; with `CROP_HEALTH_API_KEY` set → READY on
  disease photos (AUTH_FAILED if the key is rejected; UNSUPPORTED if unset).
- **mushroom.id** — wired; runs only on mushroom scans; READY with the key set.

## Verdict
Adapters + integration: **built, gated, deployed.** Live provider readiness:
**measured by the 20-scan run on Railway with keys** — not claimed here.
