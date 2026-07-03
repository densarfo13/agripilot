# Scan Runtime Engine

The full runtime, layer by layer (all real code):

| Layer | Code | Status |
|---|---|---|
| Session state machine | `src/core/scan/ScanRuntime.js` (IDLE→…→RESULT_READY) | existing |
| Image validation/repair | `ScanCapture` HEIC→JPEG normalize + photo-quality (sprint #214) | existing |
| **Recovery chain** | `src/runtime/scan/ScanRecoveryChain.ts` — automatic retry/secondary/queue/review | **NEW** |
| Retry policy | `scanRetryEngine` — transient-only, backoff, stale-session aware | existing |
| Secondary diagnosis | `hybridScanEngine` + honest heuristic classifiers (LocalCropMatcher, LeafColorAnalyzer, AgriculturalObjectClassifier) | existing |
| Offline queue | `enqueueOfflineScan` → `scan.queued`/`scan.drained`; background retry + notify | existing |
| Terminal states | `resolveScanTerminalState` — 11 states + `mayMutateFarm` safety lock | existing (prior sprint) |
| Result rendering | rich renderers wrapped in `ScanResultErrorBoundary` ("saved for review") | existing |
| Tracing | correlation id + 15-step `__scanTrace` + `/admin/scan-debug` export | existing |
| Learning | `POST /api/scan/feedback` — farmer confirm/edit corrections stored for future tuning | existing |

## Offline intelligence — honest position
There is **no trained TensorFlow/ONNX plant model** in this repo, and `check:v13-no-fake-ml`
(build:safe) forbids shipping a fake one. Offline behavior today is honest: heuristic classifiers
give bounded hints, and scans **queue** for real analysis when connectivity returns. A real on-device
model is **external work** (a trained artifact + evaluation data — the pilot's correction dataset is
exactly what would train it).

## Species coverage
Identification breadth (flowers/vegetables/fruit/trees/houseplants/weeds/unknown) comes from
plant.id's catalog + the universal object classifier taxonomy — already routed by `ScanTypeRouter`;
unknown species resolve honestly (never "Unknown Plant" dead-ends — sprint #179).
