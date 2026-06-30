# Farroway Launch Command Center

The operational system for running the first-100-farmers pilot. Not a feature — the cockpit for
the people running the pilot. The **engine** is `src/runtime/pilot/LaunchCommandCenter.ts` (pure,
tested, gate-locked); the **dashboards** read the existing observability data; the **process** is
in the playbook + runbook.

## What's live vs computed
- **Metrics source (already exists):** `scanObservability` (scanId/provider/confidence/durationMs/
  success/failureReason), `providerReliability` (p50/p95/p99, success/timeout/uptime),
  `PilotAnalyticsRuntime`, the scan lifecycle ladder. The command center **composes** these — it
  does not recompute (Build Once).
- **New engine:** `computePilotHealthScore()` (5 components → overall) + `launchGateDecision()`
  (automatic NOT_READY → PILOT_READY → READY_FOR_1000 → READY_FOR_COMMERCIAL). State changes
  **only** when predefined real-data gates are met. Honest: zero farmer data → PILOT_READY (ready
  to begin); never auto-advances to READY_FOR_1000 without real volume + every gate.

## Dashboards (read-only, from real data)
- **Pilot:** active farmers · registrations · onboarding completion · farm/crop/location/first-scan
  funnel · DAU · task completion · recommendation acceptance · marketplace · funding · crash-free.
- **Scan:** success/failed/unknown · avg + provider latency · retry/timeout rate · confidence
  distribution · top crops/diseases (all from `scanObservability` + `providerReliability`).
- **UX:** drop-off points · onboarding/scan time · navigation errors · most/least-used screens ·
  dead-end screens.
- **Quality:** crash rate · API uptime · offline sync success · translation coverage · a11y issues ·
  console errors.

## Current state (honest)
`launchGateDecision({ buildGreen: true })` → **PILOT_READY** with reason *"No real farmer data yet
— ready to BEGIN the pilot; advances automatically as metrics accrue."* This matches the standing
GO_NO_GO verdict (⚠ PILOT READY). The blocker is the **first real farmer**, not code.

See: PILOT_OPERATIONS_PLAYBOOK.md · DAILY_REVIEW_CHECKLIST.md · PILOT_METRICS.md · GO_NO_GO_RUNBOOK.md.
