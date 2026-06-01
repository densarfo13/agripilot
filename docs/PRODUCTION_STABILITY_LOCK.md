# Farroway — Permanent Production Stability Lock

A verification/lock wave (no new architecture). It conforms the operational
health probes to their contract shapes and adds governance gates so the 10
production-pilot risks can never silently regress.

> Stable for real farmers, gardeners, NGOs, and buyers. Scan / Upload /
> Login / Home are never blocked.

---

## 1. Root cause summary
The V8/V13 architecture was sound, but production risk was operational: probe
contracts drifted from the spec and several flow-critical invariants
(scan-permanent §1, upload-analysis §2, camera-gesture §3, login/location §4,
i18n §5, outcome loop §7, polling §10) were not all gate-locked. This wave
closes the contract gaps and adds the missing gates.

## 2. Files modified
- `src/runtime/scanStartup/ScanPermanentHealthRuntime.ts` — `__scanPermanent
  Health` +3 §1 keys (`takePhotoVisible`, `cameraFailureFallbackReady`,
  `analysisFailureFallbackReady`).
- `src/runtime/pilotGap/PilotGapHealthRuntime.ts` — `__uploadAnalysisHealth`
  +5 §2 keys (`scanRuntimeReady`, `normalizerReady`, `oodaNonBlocking`,
  `artifactNonBlocking`, `failureSafe`).
- `scripts/check-scan-permanent-lock.mjs` — now requires the 3 new §1 keys.
- `package.json` — 5 new gates wired into `build:safe`.

(No wave-36-protected runtime touched: `src/runtime/scan/`, `plants/*`,
`intelligenceLoop/`, `OODAEngine.ts`, `organization/`, `buyer/` untouched.)

## 3. Scan permanent lock summary
`__scanPermanentHealth()` returns the full §1 contract (13 keys): safe-shell-
first, upload-primary, upload-visible-within-1s, take-photo-visible, iOS-
autostart-disabled, camera-on-tap-only, runtime-lazy-after-image, GPS-doesn't-
block, no-infinite-spinner, upload/capture-analysis-ready, camera-failure-
fallback, analysis-failure-fallback. Locked by `check-scan-permanent-lock`.

## 4. Upload/camera analysis proof
`__uploadAnalysisHealth()` → picker / compression / scanRuntime / normalizer /
result ready + `oodaNonBlocking` + `artifactNonBlocking` + `failureSafe`
(locked by `check-upload-analysis-flow`). `check-camera-user-gesture` locks:
safe shell never calls getUserMedia, LiveCameraScanner owns the gesture-driven
getUserMedia with `playsinline` + stream cleanup.

## 5. Login/location routing proof
`__loginRoutingHealth()` already carries all §4 keys — `existingUserRoutesHome`,
`locationOptional`, `gpsFailureDoesNotBlock`, `noLocationLoop`,
`homeRequiresAuthOnly`, `scanRequiresAuthOnly` — locked by the existing
`check-login-location-routing` gate.

## 6. Language consistency proof
`check-i18n-critical-flows` locks: the `translateEntityLabel` entity layer
exists; `__languageHealth` surfaces scan/task/onboarding/weather localization
readiness for en/tw/ha/fr/sw/hi; the critical scan shells route copy through
t/tSafe/tStrict. (Deep hardcoded-string scanning stays with the existing
`check-grower-i18n-hardcoded` + `check-hardcoded-grower-copy` gates.)

## 7. OODA/artifact safety proof
`__intelligenceOODAHealth()` → `nonBlocking` + `failureSafe` + `scanIntegrated`;
`__artifactHealth()` → scan/failure/task/outcome artifacts + `nonBlocking` +
`idempotent` + `offlineSafe`. Locked by the existing `check-ooda-artifact-
safety` + the composite `check-production-stability-lock`.

## 8. Outcome loop proof
`__outcomeCaptureHealth()` → the full chain (scan → diagnosis → recommendation
→ task → follow-up scan → outcome status) + `artifactLinked` + `oodaLinked`;
outcome statuses improved/unchanged/worsened/unknown modeled in
OutcomeLearningRuntime. Locked by `check-outcome-loop`.

## 9. No-fake-intelligence proof
`check-no-fake-intelligence` (existing) + the V13 honesty contracts keep every
intelligence output to `{value, confidence, dataSources, explanation,
limitations}` with honest NEEDS_DATA / "Not enough data yet".

## 10. Polling cleanup proof
`__pollingHealth()` → `healthPollMs >= 60000`, `translationsCached`,
`authRefreshBackoffReady`, `diagnosticsThrottled`, `hiddenTabPaused`,
`no429Loop`. Locked by the existing `check-no-429-polling-loop` + the
composite stability gate (asserts health poll ≥ 60s).

## 11. Governance checks added (wired into `build:safe`)
New: `check-production-stability-lock`, `check-upload-analysis-flow`,
`check-camera-user-gesture`, `check-i18n-critical-flows`, `check-outcome-loop`.
Already enforcing: `check-scan-permanent-lock`, `check-login-location-routing`,
`check-ooda-artifact-safety`, `check-no-fake-intelligence`,
`check-no-infinite-loaders`, `check-no-429-polling-loop`. — all 11 §12 gates
in `build:safe`.

## 12. Build results
`npm run build:safe` runs the full gate chain (incl. all 11 §12 gates) + vite
build. See the build log / commit for the green run.

## 13. Final production verdict
All 10 operational stability contracts are conformed + gate-locked. Scan,
Upload, Login→Home, language, OODA, artifacts, outcome loop, no-fake-
intelligence, no-infinite-loaders, and 429-polling are all verified and
cannot silently regress. `__goLiveHealth()` / `__releaseLock()` roll up the
flags with NO_GO on real breakage; the platform sits at **GO_WITH_LIMITATIONS**
(limitations = intelligence honestly NEEDS_DATA until pilots accumulate data),
with all hard scan/routing/OODA/artifact/polling blockers green.
