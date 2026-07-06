# ADMIN_DASHBOARD_UPGRADE_REPORT.md (2026-07-05)

## Status: foundation shipped; layout upgrade scoped honestly
The spec's dashboard layout (Command Overview / Action Required / Farmer Pipeline / Pilot Health /
System Health) is a real, valuable structure — and every one of its tiles already has a data source
in the codebase (farmer counts, invite/verification queues, pilot analytics runtimes, the API/auth/
scan-provider/telemetry health composites). What it needs is a COMPOSITION layer over those existing
signals rendered with the new admin tokens, with honest empty states where a feed has no data.

That composition (5 sections × several tiles, each wired to its existing runtime + empty state) is a
focused build best done ON the token foundation delivered this pass — not fabricated with placeholder
numbers, which the "no fake values" rule and the whole session's honesty contract forbid.

## What exists to build on (no new engines needed)
- Command Overview → farmer counts + registrationStatus aggregates (existing admin APIs).
- Action Required → invite runtime (stalled), verification queue, high-risk-farms hook, sync health.
- Farmer Pipeline → registrationStatus funnel (invited→registered→approved→active→harvested).
- Pilot Health → pilot analytics runtimes (scan success, task completion, retention) — light up when
  telemetry persistence lands (master backlog #6/#7).
- System Health → the API/auth/scan-provider/telemetry/queue health composites already shipped.

## Recommendation
Build the dashboard composition as the next admin pass, on `adminTokens`/`adminTheme`, with real
data + honest empty states. Tracked in `TOP_50_FIXES.md`. No placeholder values are shipped.
