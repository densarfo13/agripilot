# PILOT_PLAYBOOK — Farroway (Workstream D)

Goal: run a 5–10 farmer pilot that produces honest evidence of farmer value, in
≤30 days, with a clear go/no-go.

## Pilot checklist (Day 0)
- [ ] Providers `PRODUCTION_CERTIFIED` (one real scan → `railway run npm run scan:certify`).
- [ ] 5–10 farmers recruited (one crop type cluster keeps results comparable).
- [ ] Each farmer: account + language set + at least one crop + planting date.
- [ ] A field officer / contact each farmer can reach (the copilot declines what it
      can't answer and routes to a human — that human must exist).
- [ ] Reliability dashboard (`/admin/scan-health`) bookmarked; credit alerts set.
- [ ] Weekly review slot booked; bug-triage channel created.

## Pilot scorecard (review weekly)
| Metric | Green | Yellow | Red |
|---|---|---|---|
| Onboarding completion | ≥70% | 40–70% | <40% |
| Scans/active farmer/week | ≥3 | 1–3 | <1 |
| Recommendation "useful" | ≥60% | 40–60% | <40% |
| Task completion (7d) | ≥50% | 30–50% | <30% |
| Provider success rate | ≥95% | 85–95% | <85% |
| Crash-free sessions | ≥99% | 97–99% | <97% |
| D7 retention | ≥40% | 20–40% | <20% |

## Farmer interview guide (after week 2, 15 min each)
1. What did you scan, and did the answer match what you knew?
2. Did you DO anything differently because of it? (the real signal)
3. Where did you get stuck or confused?
4. Was the language clear? Did you use voice?
5. Would you tell another farmer to use it? Why / why not?
6. One thing that would make it more useful?
(Capture verbatim. Trust > satisfaction scores.)

## Weekly review process (60 min)
1. Scorecard vs targets (5 min). 2. Top 3 friction points from data + interviews
(20). 3. Bug triage (15). 4. Decide 1–2 changes to ship that week (15). 5. Log
decisions (5). Output: a dated entry + the week's ship list.

## Bug triage process
- **P0** (farmer blocked / data loss / security): fix same day, hotfix deploy.
- **P1** (degrades core scan/recommend flow): fix this week.
- **P2** (annoyance / cosmetic): backlog, batch monthly.
Every P0/P1 gets a root-cause line + a regression gate where feasible (the platform
idiom). Use `window.__swallowedErrors()` + reliability dashboard to find silent ones.

## Feature request workflow
Capture → tag (product/ML/ops) → score against the 5-question filter (improves farmer
outcomes? simpler? reliable? measurable? reduces debt?) → only build YES. Reject
speculative AI / fabricated values by policy.

## Success metrics (pilot is a success if)
≥6 of 10 farmers active in week 4 · ≥3 scans/farmer/week · ≥60% useful · ≥1 farmer
reports a real action taken from a recommendation · crash-free ≥99% · 0 fabrication
incidents.

## Kill criteria (stop / rethink if)
- Providers can't be certified after real scans (genuine AUTH/credits failures unfixed).
- <30% onboarding completion after 2 weeks of UX fixes.
- Recommendations "useful" <40% AND no clear fixable cause.
- A fabrication/safety incident (a farmer acted on a fabricated value) — hard stop.

**NOW:** run the Day-0 checklist + first scan. **NEXT:** weekly review #1 + interviews.
**LATER:** scale to 50–100 only after a green scorecard.
