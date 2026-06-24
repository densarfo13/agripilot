# PILOT_ACTIVATION_REPORT.md

**Sprint #217 — pilot activation + retention readiness.**
Date: 2026-06-19.

## What this sprint added (focus: adoption, not engines)
- `FirstFiveMinutesEngine` — timed activation funnel + top drop-off.
- `Day2RetentionEngine` — 24h Farm Brief + engagement tracking.
- `FarmSuccessEngine` — success score (reuses #212 completion).
- `check:activation-retention` premortem gate.

## Reused (already shipped)
- Home above-fold hero (Farm Health / Today's Action / Reason /
  Confidence) — CommandCenterDeck (#192-#194); Farm Success renders
  alongside via the #209 below-fold + this engine.
- Pilot Command Center (Activation / First Scan / First Task / Outcome
  / D1 / D7) — PilotAnalyticsPage (#157/#189) + PilotMetricsAggregator
  (#188) + PilotReadinessDashboard (#215). The new "Top Drop-Off Screen"
  is fed by FirstFiveMinutesEngine.dropOffStep.

## The two questions
1. **Value in 5 minutes?** The funnel is built so every step has a CTA,
   the first scan is reachable (gate-asserted), and the result always
   has a next action (#214 trust gate). Engineering: YES. Proof: needs
   a real farmer.
2. **Back on Day 2?** The Day-2 brief + one CTA are wired. Whether they
   actually retain is a DATA question only the pilot answers.

## Verdict
**READY_FOR_PILOT (engineering).** Both questions are answerable in the
product; neither is answered in the data yet — because there are no
users. The funnel + Day-2 engines are precisely the instruments that
will answer them once the cohort starts. The blocker is not code; it is
launching to farmers.
