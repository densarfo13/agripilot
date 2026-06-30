# Quality Gate System

`npm run build:safe` runs the full chain (~397 gates) and must end with
`[build:safe] PASS — N steps green.` Every gate is registered both as an npm script AND in the
`build:safe:steps` chain. A merge that breaks any gate fails the build.

## Release-blocking, auto-enforced today
- Design-system foundation (`check:design-system-v1`) + 24-assertion token test.
- Inline-color ratchet (`check:design-lint`) — UI consistency can only improve.
- Copy governor (`check:copy-governor`) + jargon gates — no internal wording reaches farmers.
- Screen contracts (`check:screen-contract`) — every core screen declares purpose/question/CTA/success.
- Language consistency + parity, empty-state guidance, mobile-safe layout, one-primary-action.
- Product honesty gates: scan (no fabricated diagnosis), FarmBrain data-integrity, sell decision
  (no fabricated price), location no-dead-end.

## Release-blocking, verified OFF the build (device / pilot)
Per the Production Certification (verdict GO_FOR_INTERNAL_TEST), these block a *public* launch and
are verified on real devices, not by `build:safe`:
- Real-image scan accuracy; on-device GPS; performance (first-paint / latency); telemetry coverage;
  app-wide accessibility (VoiceOver / dynamic type / reduced motion).

## CI/CD
`build:safe` is the merge gate — lint, typecheck, tests, all governance gates, and the production
build run inside the chain. Ratchet baselines (`design-debt-baseline.json`,
`copy-governor-baseline.json`) are committed so the ratchets are deterministic across machines.
