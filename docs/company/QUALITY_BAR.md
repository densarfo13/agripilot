# Farroway — Quality Bar (every pull request)

Every PR must answer all eight. A PR missing any of these is not ready.

1. **Problem** — the farmer-facing symptom or the KPI being improved.
2. **Root cause** — what actually causes it (verified in the code/data, not guessed).
3. **Fix** — the change, preferring one source of truth over a parallel path.
4. **Tests** — a regression test that fails before and passes after; plus a `build:safe`
   gate so it can't silently come back.
5. **Performance impact** — does it add a request, a render, sync work on a hot path? State it.
6. **Rollback** — how to undo it (revert commit / flip flag).
7. **Risk** — what could this break; what's explicitly out of scope or deferred (be honest).
8. **Success metric** — which KPI this moves and how we'll know (the telemetry/source).

## No feature ships without

A *new capability* (not a bug fix) additionally requires all of:

- Unit tests **and** an integration test of the real path.
- Telemetry (it can't be a feature if we can't measure it).
- Rollback (revert commit or feature flag).
- Documentation (at least the PR's Problem→Success-metric; user-facing copy where relevant).
- **Accessibility** — 48px touch targets, aria labels, legible contrast (low-literacy users).
- **Localization** — all visible strings via the i18n layer; no hardcoded English.
- Performance review — first-paint / hot-path impact stated.

## Every bug

Root cause (verified) · fix · regression test + gate. No exceptions.

## The build is the contract

`npm run build:safe` runs the full gate chain and must end with
`[build:safe] PASS — N steps green.` Each gate is registered both as an npm script **and**
in the `build:safe:steps` chain. A fix that touches a known failure mode adds a gate so the
mode is locked.

## Honesty checks (hard fails)

- No fabricated diagnosis / confidence / treatment / translation / metric.
- No secret (API key, auth header) or image bytes in logs or stored traces.
- No precise coordinates persisted in diagnostics — coarse (≈1 km) only.
- Farmer-facing failures are specific (no generic "Unknown" / "couldn't detect") and never
  dead-end.
