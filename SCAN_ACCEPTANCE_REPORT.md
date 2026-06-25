# SCAN_ACCEPTANCE_REPORT — P0 §2 / §10

## Provider status (acceptance gate)
`window.__scanAcceptanceHealth()` computes readiness from the real
`/api/scan/diagnostics` envelope — **nothing is hardcoded to true.**

| Provider | Configured | Ready | Notes |
|---|---|---|---|
| Plant.id | ✅ (`PLANT_API_KEY`) | gated on a live call | ready ⇔ configured + httpStatus 200 + candidates>0 + confidence>0 |
| Crop.health | ❌ `CROP_HEALTH_API_KEY` unset | **false** | not faked |
| Insect.id | ❌ `INSECT_ID_API_KEY` unset | **false** | may be gracefully disabled when no insect mode |

## 10-scan acceptance result
The harness `scripts/run-scan-acceptance.mjs` is **built and runnable** but the
live run is **not executed from this environment** — and I will not fabricate
its results. A real run requires:
- a deployed app URL (`SCAN_API_BASE`) + an auth token (`SCAN_API_TOKEN`)
- the 10 acceptance images (`SCAN_IMAGE_DIR`)
- the missing provider keys (crop.health / insect.id)

Current harness output: **`LIVE RUN PENDING`** — `identified 0/10 (live run NOT
configured)`. The per-scan columns (scanId, imageType, provider, httpStatus,
candidateCount, topCandidate, confidence, healthStatus, insectStatus,
taskCreated, farmBrainIngested, failureReason) are emitted; each row reports
`live_run_not_configured` or `image_missing`, never a fake pass.

### To execute the real acceptance run
```
SCAN_API_BASE=https://<railway-app> \
SCAN_API_TOKEN=<admin token> \
SCAN_IMAGE_DIR=./acceptance-images \
npm run scan:acceptance
```
Test set: onion / tomato / pepper / maize / okra leaf, healthy leaf, diseased
leaf, insect-on-leaf, fruit-vegetable, blurry. Acceptance bar: 8/10 plant scans
identify; 0 clear photos → provider_unconfigured / auth failure / unexplained
"Scan unclear"; low-confidence → review queue; no weak scan enters FarmBrain.

## Failed scans and reasons
None executed yet (live run pending). The **safety invariants** that protect a
failed scan are enforced now by build gates:
- a weak/unclear scan **cannot** create a plant or task (trust gate)
- a weak scan **cannot** enter FarmBrain (ingestion gate, this sprint)
- a provider candidate is never silently dropped to "Unknown plant" (mapping gate)

## Build result
`npm run build:safe` — green (see commit). New gates: `check:scan-provider-auth`,
`check:scan-result-mapping`, `check:farmbrain-scan-ingestion`.

## Final verdict: **BLOCKED**
Blocked on two operator actions, not on code:
1. Set `CROP_HEALTH_API_KEY` + `INSECT_ID_API_KEY` on Railway.
2. Execute the live 10-scan run and confirm 8/10 + the zero-tolerance rows.

Plant.id alone, once a live call confirms `httpStatus:200`, reaches
**SCAN_READY**; all three providers + a passing live run reach
**FARMBRAIN_READY_FOR_PILOT**. The acceptance gate computes this verdict
honestly from live signals — it does not assume it.
