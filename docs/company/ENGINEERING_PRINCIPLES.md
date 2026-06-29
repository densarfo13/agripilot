# Farroway — Engineering Principles

## Priority order (what to work on next)

1. **Fix bugs** — a wrong result for a farmer is the highest-priority work.
2. **Improve reliability** — make it work on a real phone, weak signal, offline.
3. **Improve recommendation quality** — better evidence, better ranking, honest confidence.
4. **Improve performance** — faster first paint, fewer re-fetches.
5. **Improve UX** — fewer taps, clearer copy, no dead ends.
6. **Build new capability** — last, and only with production evidence (see the charter).

## How we work

- **One source of truth.** No duplicate logic. When two paths must agree, extract one shared
  function and have both call it (e.g. confidence normalization, consensus mode, location
  verdicts).
- **Reproduce → root-cause → fix → regression-test → gate → deploy.** Every bug fix ships
  with a test that fails before and passes after, plus a `build:safe` gate so it can't
  silently regress.
- **Reject the not-live.** When investigating, verify the data shapes and control flow before
  "fixing" — do not ship hardening against hypotheticals. Record why a candidate was rejected.
- **Honesty over completeness.** Surface what's deferred and why; never claim a thing is done
  or verified when it isn't (e.g. field/CV accuracy and on-device matrices can't be proven
  from CI — say so).
- **Gate everything.** The build is the contract: `npm run build:safe` must end with
  `[build:safe] PASS — N steps green.` A change is not done until the full chain is green.

## The honesty doctrine (applies to all code)

Never invent a diagnosis, confidence value, treatment, translation, provider status, market
price, yield, or metric. Unknown / no_live_feed / lab_required / awaiting_model are valid,
honest states. A confident fabrication is the one defect we never ship.
