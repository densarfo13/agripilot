# Release Standard

Every release runs `npm run build:safe` (~398 gates) and must end with
`[build:safe] PASS — N steps green.`

## Auto-validated before merge (in the chain)
Automated tests · lint · typecheck · production build · design + copy + feature + screen governors ·
localization parity · data-integrity + AI-honesty gates · enterprise isolation/audit/federation ·
`check:release-governor` + `check:release-lock`.

## Verified off-build (device / pilot — blocks PUBLIC launch)
Accessibility (device VoiceOver/dynamic-type) · performance (first-paint/latency/60fps) · visual
regression · real-image scan accuracy · on-device GPS · telemetry coverage. These are the
GO_FOR_INTERNAL_TEST → GO_FOR_25_USER_PILOT conditions in PRODUCTION_CERTIFICATION.md.

## Release ladder (honest, from the production certification)
NO_GO · GO_WITH_CONDITIONS · **GO_FOR_INTERNAL_TEST (current)** · GO_FOR_25_USER_PILOT ·
GO_FOR_PUBLIC_LAUNCH. Public launch is locked until a real 25-user pilot produces scan-success /
retention / crash-free metrics.
