# Pilot Operations Playbook

How to run the first-100-farmers pilot day to day. The product is PILOT_READY; this is how the
people running it operate.

## Roles
- **Pilot lead** — owns the go/no-go state + the daily review.
- **Field officer(s)** — onboard farmers, gather feedback, log issues.
- **On-call engineer** — triages Critical/High issues.

## Feedback intake
Every feedback item is logged with: **Category · Severity · Screenshot (if any) · Device · Language ·
Farm · Status · Owner · Resolution.** Source: field officer + in-app. Store: the pilot feedback log
(start a shared sheet/tracker; promote to a table when volume warrants — do not build a feature for it).

## Bug triage (every issue)
| Severity | Definition | Target fix |
|---|---|---|
| **Critical** | data loss, crash on core path, farmer blocked, safety/honesty breach | same day |
| **High** | core path degraded, wrong/confusing advice, frequent | 48h |
| **Medium** | minor UX, infrequent | next cycle |
| **Low** | cosmetic | backlog |
Each issue records **Impact · Frequency · Owner · Target fix date**. Critical/High → fix lands with
a regression test + a `build:safe` gate (Engineering Constitution).

## Daily loop
1. Run DAILY_REVIEW_CHECKLIST.md.
2. Read the dashboards (LAUNCH_COMMAND_CENTER.md) — funnel, scan, quality.
3. Triage new feedback/bugs.
4. Recompute the go/no-go state (`launchGateDecision`) — note any movement.
5. Escalate Critical/High; communicate status.

## Escalation
- Crash-free drops below the pilot floor → state auto-flips to NOT_READY → **pause new onboarding**,
  fix, re-verify.
- Provider outage (timeout/auth spike) → the scan alerts fire (SUCCESS_RATE_DROP / TIMEOUT_SPIKE);
  switch to the honest "scan service is busy" farmer message (already wired) until recovered.

## Honesty rules (non-negotiable in a pilot)
- Never fabricate a metric to look ready. The engine won't let the state lie; neither do we.
- A farmer-affecting honesty breach (fabricated diagnosis/price) is **Critical**, always.
