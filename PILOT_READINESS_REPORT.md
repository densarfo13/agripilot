# PILOT_READINESS_REPORT

Supersedes the sprint #215 edition (2026-06-19). Updated for the production-hardening
sprint.

## Ready
- **Security:** every `/api/admin` route role-gated server-side (`check:admin-route-auth`).
- **Provider keys:** all set on Railway (verified via `scan:certify` runtime).
- **Reliability observability:** `ProviderReliabilityCard` on the admin Scan Health page
  shows per-provider 24h latency/success/error/uptime/confidence from real metrics.
- **Credit protection:** duplicate-scan guard + too-small-photo rejection cut wasted
  provider calls.
- **Failure visibility:** structured swallow telemetry + global error capture
  (`window.__swallowedErrors()`) — silent failures are now counted/categorized.
- **build:safe:** 363 gates green; deployed.

## The one threshold left to cross (operator action)
Providers read `DEGRADED` (keyed, configured, unproven) until a REAL scan exercises
them. **Do one real scan in the deployed app** (or `SCAN_API_BASE=<url> npm run
scan:acceptance`), then re-run `railway run npm run scan:certify` → providers lift
`DEGRADED → READY` → overall `PRODUCTION_CERTIFIED`. If a provider instead shows a
genuine `AUTH_FAILED` / `CREDITS_EXHAUSTED`, that is now a true signal to fix.

## Honest PENDING (not blockers, not faked)
- **Accuracy benchmark:** `golden-dataset/manifest.json` empty → accuracy `PENDING`
  until populated with verified images.
- **CV measurements** (counts/severity): `awaiting_model` until a segmentation model
  is deployed — never fabricated.
- **Scan UX polish (#2) + boot perf (#3):** scoped, staged as the next focused,
  preview-verified batch.

## Verdict
**Production-ready for a small (5–10 farmer) pilot.** The platform is honest end-to-end,
secured, and observable. The pilot's first real scan is both the proof step and the
first farmer value.
