# Scan Recovery Pipeline

**The self-healing chain (this sprint):** `src/runtime/scan/ScanRecoveryChain.ts` —
`runScanRecoveryChain()`. Farmer presses Scan once; every transition is automatic:

```
validate → repair → primary provider → (auto-retry if transient) → secondary engine
        → offline queue (SAVED_FOR_RETRY) → needs review (QUEUED_FOR_REVIEW)
```

- **Composes existing stages by injection** (Build Once): image validation/photo-quality, HEIC→JPEG
  repair, the retry-wrapped provider call, `hybridScanEngine` secondary, `enqueueOfflineScan`.
  No stage was reimplemented; the scan engine was not refactored.
- **Transient-only retry** — `isRetriableScanFailure` gates the extra attempt (auth/credits never
  burn a second provider call).
- **Never dead-ends, never throws** — a stage that throws counts as that stage failing; the chain
  continues. Ultimate outcomes are `SAVED_FOR_RETRY` (photo kept, background retry) or
  `QUEUED_FOR_REVIEW`. All outcomes resolve through `resolveScanTerminalState` (11 named states +
  the `mayMutateFarm` safety lock).
- **Farmer-facing progress** (Phase 6 copy, no technical wording): "We're checking your photo…" →
  "Improving image quality…" → "Double-checking with another expert…" → "We're almost done…".
  On total failure: retake / choose photo / save for review — never "Scan temporarily unavailable".

**Verified:** 12-assertion adversarial test + `check:scan-recovery-chain` gate (in build:safe).
