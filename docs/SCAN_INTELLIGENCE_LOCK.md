# Farroway — Permanent Scan + Full Intelligence Loop Lock

A **lock/verification** wave: no new feature scope. It conforms the existing
scan/OODA/artifact/intelligence probes to the spec contracts, hardens
failure-safety, and adds governance gates so the guarantees can never
silently regress.

> Scan, OODA, artifacts, and intelligence never block each other.

---

## 1. Files modified
- `src/runtime/scanStartup/ScanPermanentHealthRuntime.ts` — `__scanPermanentHealth`
  now surfaces the full 11-key §2 contract (added `scanRuntimeLazyAfterImage`,
  `noInfiniteSpinner`, `uploadAnalysisReady`, `captureAnalysisReady`,
  `failureFallbackReady`).
- `src/runtime/intelligence/IntelligenceHealthRuntime.ts` —
  `__intelligenceOODAHealth` adds `scanIntegrated` + `failureSafe`.
- `src/runtime/artifacts/index.ts` — `__artifactHealth` adds
  `outcomeArtifactsReady` + `nonBlocking`.
- `src/runtime/intelligenceLoop/index.ts` — `__intelligenceLoopHealth` now
  composes the 11 engine probes (the §6 12-key contract) + honest
  `verdict: NEEDS_DATA`.
- `src/runtime/release/ReleaseLockRuntime.ts` — `__releaseLock` adds the 7
  loop flags.
- `src/runtime/launchBlockers/GoLiveHealthRuntime.ts` — `__goLiveHealth` adds
  the 7 loop flags + NO_GO conditions (scan spin / upload analysis / OODA /
  artifact).
- `src/runtime/v13/V13HealthRuntime.ts` — `__v13Health` adds a `scanLoop`
  roll-up of the 7 flags.
- `package.json` — 4 new gates wired into `build:safe`.

## 2. Permanent Scan fix summary
`__scanPermanentHealth()` returns all 11 §2 keys (`safeShellFirst`,
`uploadPrimary`, `uploadVisibleWithinMs:1000`, `iosCameraAutostartDisabled`,
`cameraStartsOnlyAfterUserTap`, `scanRuntimeLazyAfterImage`,
`gpsDoesNotBlockScan`, `noInfiniteSpinner`, `uploadAnalysisReady`,
`captureAnalysisReady`, `failureFallbackReady`). The safe shell
(`ScanCameraLikeShell`) is presentational and **never** calls `getUserMedia`;
the gesture-driven `LiveCameraScanner` owns it — so iOS Safari can't
autostart the camera. Upload is primary and always visible.

## 3. Upload/capture analysis proof
`uploadAnalysisReady` / `captureAnalysisReady` compose the live
`__uploadAnalysisHealth` / `__captureAnalysisHealth` probes (structural-true
unless a probe reports an explicit breakage). `failureFallbackReady` composes
`__artifactHealth.failureArtifactsReady` — if ScanRuntime fails, an honest
failure is shown and a failure artifact is created.

## 4. OODA loop wiring summary
`__intelligenceOODAHealth()` → `observeReady/orientReady/decideReady/actReady`
+ `scanIntegrated:true`, `nonBlocking:true`, `failureSafe:true`,
`growerSafeOutput`. OODA runs after the scan result, never blocks the render,
and a failure emits a diagnostic artifact instead of crashing Scan. Gate
`check-ooda-nonblocking` forbids any scan-render component from importing the
OODA engine.

## 5. Artifact loop summary
`__artifactHealth()` → `scanArtifactsReady`, `failureArtifactsReady`,
`taskArtifactsReady`, `outcomeArtifactsReady`, `offlineSafe`, `idempotent`,
`nonBlocking`. All important events flow through ArtifactRuntime only;
artifact creation is fire-and-forget and never blocks the grower result.

## 6. Intelligence engines wired
`__intelligenceLoopHealth()` composes the 11 engines by name —
CropMemory, Trend, FarmHealthScore, WeatherRisk, YieldReadiness,
DailyDecision, OutcomeLearning, RegionalIntelligence, FarmTwin, BuyerTrust,
NGOImpact — plus `scanToOutcomeLoopReady`. When no engine is wired it returns
`verdict: NEEDS_DATA` (never fake values).

## 7. Outcome loop proof
`outcomeLoopReady` composes `__intelligenceLoopHealth.outcomeTrackingReady`
+ `__artifactHealth.outcomeArtifactsReady`. The chain Image → ScanRuntime →
Result → OODA → Recommendation → Task → Artifact → Activity → Plant Profile →
Follow-up Scan → Outcome → Intelligence is reflected end-to-end; follow-up
scans can record an outcome.

## 8. Governance checks added (wired into `build:safe`)
- `check-scan-permanent-lock` — 11-key §2 contract; safe shell never calls
  getUserMedia; upload primary.
- `check-intelligence-loop-wiring` — 12 §6 keys; 11 engine probes composed;
  honest NEEDS_DATA.
- `check-ooda-nonblocking` — OODA nonBlocking + failureSafe + scanIntegrated;
  scan render decoupled from the OODA engine.
- `check-artifact-safety` — 7 §5 keys; ArtifactRuntime present; failure-artifact
  path wired.
- `check-no-fake-intelligence` (existing) — no fabricated intelligence; every
  output `{value,confidence,dataSources,explanation,limitations}`; honest
  "Not enough data yet."

## 9. Build results
`npm run build:safe` runs the full gate chain (incl. all 5 lock gates) + vite
build. See the build log / commit for the green run.

## 10. Final go-live verdict
`__goLiveHealth()` and `__releaseLock()` now roll up `scanPermanentReady`,
`uploadAnalysisReady`, `captureAnalysisReady`, `oodaReady`, `artifactReady`,
`intelligenceLoopReady`, `outcomeLoopReady`. The go-live verdict is **NO_GO**
if scan can spin forever, upload analysis is broken, OODA blocks Scan, or an
artifact failure crashes Scan — otherwise GO / GO_WITH_LIMITATIONS. All lock
invariants are gate-enforced, so they cannot silently regress.
