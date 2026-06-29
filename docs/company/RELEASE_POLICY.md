# Farroway — Release Policy

## Cadence

- **Maximum one major capability per release.** Everything else in a release is incremental.
- **Unlimited, any time:** bug fixes · reliability · performance · localization · security ·
  telemetry. These never count against the one-capability limit.

## Definition of done for a release

- `npm run build:safe` ends with `[build:safe] PASS — N steps green.`
- Every change in the release carries a regression test/gate (see [QUALITY_BAR.md](QUALITY_BAR.md)).
- No fabricated data, no secrets logged, no precise coordinates / image bytes persisted.

## Measure every release

These are **definitions + sources**, not stored values. Numbers come from production
telemetry at release time — never invented in code or docs.

| Metric | Source |
|---|---|
| Scan success | scan telemetry + `GET /api/admin/scan/last-trace` |
| Location success | location telemetry + `GET /api/admin/location/debug` |
| Recommendation success | outcome telemetry (`outcomeIntelligenceEngine`) |
| Crash-free sessions | client error reporting |
| Daily active farmers | pilot analytics |
| Weekly retention | pilot analytics |
| Provider uptime | per-scan provider metrics + `classifyProviderFailure` |

## STOP conditions (halt the release)

Halt and roll back if, relative to the previous release:

- Scan success **drops**, or
- Onboarding completion **drops**, or
- Recommendation confidence **decreases**, or
- Crash rate **increases**.

A release that trips a stop condition is reverted first, diagnosed second.

## Rollback

Every change states its rollback in the PR (see [QUALITY_BAR.md](QUALITY_BAR.md)). Default
rollback is `git revert` of the change's commit; feature-flagged work flips its flag off.
