# Daily Review Checklist

Run every day of the pilot. ~10 minutes. Tick, note anomalies, escalate.

## Stability (first — a red here pauses onboarding)
- [ ] Crash-free sessions ≥ 0.97 (pilot floor). If below → state NOT_READY → pause new onboarding.
- [ ] No new Critical bug open past its target fix date.
- [ ] API uptime healthy; no provider in sustained outage (check scan alerts).

## Funnel (are farmers getting through?)
- [ ] New registrations vs onboarding completions — note the drop-off step.
- [ ] First-scan completion trend (the activation moment).
- [ ] DAU + D7 retention trend.

## Scan (the core promise)
- [ ] Scan success rate; unknown/failed rate not spiking.
- [ ] p95 latency within budget; retry/timeout rate normal.
- [ ] Confidence distribution sane (not collapsing to all-low).
- [ ] Spot-check 2–3 real scans via `/api/admin/scan/last-trace` — honest result, no fabrication.

## Recommendation + tasks
- [ ] Recommendation acceptance trend; task completion trend.
- [ ] No fabricated advice reported.

## Quality
- [ ] No raw translation keys / English leaks reported on any core screen.
- [ ] No backend wording reported.
- [ ] Console errors / navigation errors triaged.

## Feedback + triage
- [ ] All new feedback logged (category/severity/device/language/owner).
- [ ] Critical/High assigned with a target fix date.

## Decision
- [ ] Recompute go/no-go (`launchGateDecision`). Record state + any movement toward READY_FOR_1000.
- [ ] One-line status to the team: state · Pilot Health Score · top issue.
