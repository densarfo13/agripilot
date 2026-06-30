# Go / No-Go Runbook

The launch state advances **automatically** when real-data gates are met — no manual flag. The
engine is `src/runtime/pilot/LaunchCommandCenter.ts` (`launchGateDecision`), gate-locked by
`check:launch-command-center` (12-assertion test).

## The four states

| State | Meaning | Entry condition (real data) |
|---|---|---|
| **NOT_READY** | do not run | `build:safe` not green, OR (with live traffic) crash-free < 0.95 |
| **PILOT_READY** | run the 100-farmer pilot | build green + safety invariants + no hard blocker. **Current state.** Zero farmer data is fine — you're ready to BEGIN. |
| **READY_FOR_1000** | scale to 1,000 | ≥50 farmers · crash-free ≥0.99 · onboarding ≥70% · scan-success ≥85% · rec-acceptance ≥30% · D7 retention ≥30% · satisfaction ≥70% |
| **READY_FOR_COMMERCIAL** | commercial launch | ≥500 farmers · crash-free ≥99.5% · onboarding ≥80% · scan-success ≥92% · rec-acceptance ≥40% · D7 ≥40% · satisfaction ≥80% · p95 ≤4s |

A state is granted only when **every** gate metric is met by real data. Unmeasured satisfaction or
sub-floor volume **blocks** the advance — the engine reports `unmetForNext` so the team knows exactly
what's missing. It never fabricates a state.

## Current state
`launchGateDecision({ buildGreen: true })` → **PILOT_READY** (no real farmer data yet). This matches
the GO_NO_GO_DECISION.md verdict (⚠ PILOT READY) and the scan lifecycle (DEVELOPMENT) + provider cert
(NOT_CERTIFIED until a real scan). Everything converges: **ready to begin the pilot; the gate to
everything above is real farmer data.**

## How it advances (operational)
1. Begin the pilot (PILOT_CHECKLIST.md). Real scans + onboarding populate the metrics.
2. The daily review recomputes the state. As metrics cross the READY_FOR_1000 gates, the state moves
   on its own.
3. A regression (crash-free drop) auto-reverts toward NOT_READY → pause, fix, re-verify.

## Hard rule
The state machine is the single source of truth for launch readiness. Do not override it with a
manual flag — if the gates aren't met, the product isn't ready, and saying otherwise breaks the one
thing Farroway competes on: trust.
