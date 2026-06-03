# TODAYS_ACTION_ENGINE_REPORT

**Mission:** make Farroway indispensable every morning. Farmer opens app → immediately knows what to do today.

**Sprint:** Today's Action Engine V1 (funnel + task + outcome + KPI)
**Date:** 2026-06-02
**Modes:** `/godmode` `/ooda` `/artifacts`

This sprint **extends** the prior Recommendation Engine V1 with the missing operational glue: when the farmer taps **Start**, a real task is created, the 3/7/14-day follow-up plan is provisioned, an outcome path opens, and every funnel step is logged so the founder can see the completion %.

---

## What changed since the prior sprint

| Layer | Prior | This sprint |
|---|---|---|
| Recommendation | `/api/daily-action` returns the action | + auto-logs `shown` funnel event with `actionId` |
| Start button | navigated to `/tasks` | calls `POST /api/daily-action/start` → creates `Task` row + `buildFollowUpPlan` (3/7/14 days) + logs `started` |
| Mark complete | (none) | new "Mark complete" button → `POST /api/daily-action/complete` → logs `completed` |
| Outcome capture | (none) | Better/Same/Worse prompt → `POST /api/daily-action/outcome` → logs `outcome_recorded` |
| Founder KPI | (none) | `GET /api/daily-action/kpi` returns 5-stage funnel with `completionPct` vs target 50% |
| Schema | (none) | new table `todays_action_events` via migration `20260603100000_todays_action_events` |

---

## Spec → delivery

| Spec | Delivery |
|---|---|
| Create `RecommendationEngine.ts` | Already exists from prior sprint at `src/runtime/dailyAction/RecommendationEngine.ts` — **extended** with 4 new funnel adapters (`startDailyAction`, `completeDailyAction`, `recordDailyActionOutcome`, `fetchDailyActionKpi`) |
| Inputs (6) | All composed in `/api/daily-action` (prior sprint, preserved) |
| Output shape | Preserved exactly: `{ action, priority, reason, confidence, estimatedTime, followUpDate }` + funnel addition: `actionId` |
| Action rules: 1 primary, max 3 supporting, never 10/checklists/conflicts | Engine returns `topThree.slice(0, 3)` — gate-locked literal |
| Home page: Today's Action, Why, Time Required, [START] [SCAN] | `TodaysActionCard` (prior) extended with full funnel state machine |
| Command Center: only 5 fields | `DailyCommandCard` (prior, preserved) |
| **Task Creation: Start auto-creates task + follow-up + outcome path** | `POST /api/daily-action/start` does all 3 (gate enforces `buildFollowUpPlan` + `persistFollowUpPlan` + `started` event) |
| **Outcome Loop: Did conditions improve? Better/Same/Worse** | New outcome prompt embedded in TodaysActionCard appearing after `completed` state |
| **Founder KPI: Shown / Started / Completed / OutcomeRecorded / FollowUpCompleted** | `computeFunnel()` returns all 5 stages with per-stage count + pctOfShown |
| **Primary KPI: Today's Action Completion % > 50%** | `TARGET_COMPLETION_PCT = 50` (gate-locked literal); `meetsTarget` boolean on every funnel envelope |
| BUILD SAFE rules | Gate `check-todays-action-engine.mjs` enforces all 4 (no action, >3 actions, no follow-up, no outcome path) |

---

## Funnel state machine (client)

```
TodaysActionCard
  ─────────────────────────────────────────────
  state: 'idle'
    UI: [Start] [Scan]
    ──────  user taps Start  ──────►
  state: 'starting'  (server creates task + follow-up + logs 'started')
    ──────  success  ──────►
  state: 'started'
    UI: [Mark complete]
    ──────  user taps Mark complete  ──────►
  state: 'completed'   (logs 'completed' event)
    UI: "Did conditions improve?"  [Better] [Same] [Worse]
    ──────  user taps any  ──────►
  state: 'outcome_recorded'   (logs 'outcome_recorded' event)
    UI: "✓ Outcome recorded. See you tomorrow."
```

Each transition fires a single funnel event server-side. The KPI engine groups by `kind` to produce the 5-stage funnel.

---

## Honesty contract

- `completionPct` returns `null` (not 0) when fewer than 5 `shown` events exist — never fakes a "0% completion" alarm on day 1.
- `meetsTarget` returns `null` (not `false`) under the same threshold.
- All gate-enforced literals: `MIN_SAMPLE = 5`, `TARGET_COMPLETION_PCT = 50`, 5 funnel `KIND_VALUES`, 3 outcome `OUTCOME_VALUES`, `slice(0, 3)` cap.

---

## Files

**New (4):**
- `server/prisma/migrations/20260603100000_todays_action_events/migration.sql`
- `server/src/ml/todaysActionFunnel.js` — logEvent + computeFunnel
- `scripts/check-todays-action-engine.mjs` — contract gate
- `TODAYS_ACTION_ENGINE_REPORT.md` (this file)

**Extended (5):**
- `server/prisma/schema.prisma` — added `TodaysActionEvent` model
- `server/src/app.js` — added 4 routes (`/start`, `/complete`, `/outcome`, `/kpi`); extended GET `/api/daily-action` to auto-log `shown`
- `src/runtime/dailyAction/RecommendationEngine.ts` — added 4 funnel adapter exports
- `src/components/intelligence/TodaysActionCard.jsx` — full funnel state machine with Mark complete + Better/Same/Worse prompt
- `package.json` — registered gate + added to build:safe:steps

**0 wave-36 frozen files modified.**

---

## Verification

```bash
# Today's action — now returns actionId for the funnel:
curl -H 'Cookie: <session>' https://www.farroway.app/api/daily-action | jq .actionId

# Start the action — server creates task + follow-up + outcome path:
curl -X POST -H 'Cookie: <session>' \
     -H 'Content-Type: application/json' \
     -d '{"actionId":"ta_xxx","action":"Inspect lower onion leaves","priority":"high","category":"disease"}' \
     https://www.farroway.app/api/daily-action/start | jq
# → { ok: true, taskId: "...", outcomePathReady: true,
#     followUpPlanItems: [ {dayOffset:3,...}, {dayOffset:7,...}, {dayOffset:14,...} ] }

# Mark complete:
curl -X POST -H 'Cookie: <session>' \
     -H 'Content-Type: application/json' \
     -d '{"actionId":"ta_xxx","taskId":"..."}' \
     https://www.farroway.app/api/daily-action/complete

# Record outcome:
curl -X POST -H 'Cookie: <session>' \
     -H 'Content-Type: application/json' \
     -d '{"actionId":"ta_xxx","outcome":"better"}' \
     https://www.farroway.app/api/daily-action/outcome

# Founder KPI (admin / NGO / field_officer):
curl -H 'Cookie: <admin>' \
     https://www.farroway.app/api/daily-action/kpi?days=30 | jq
# → { ok: true, windowDays: 30, uniqueUsersShown: N,
#     stages: [{kind:'shown',count,pctOfShown},
#              {kind:'started',count,pctOfShown},
#              {kind:'completed',count,pctOfShown},
#              {kind:'outcome_recorded',count,pctOfShown},
#              {kind:'follow_up_completed',count,pctOfShown}],
#     outcomes: {better,same,worse},
#     completionPct, target: 50, meetsTarget,
#     limitations: "Decision support, not a guarantee." }
```

---

## Build state

- `build:safe` → all gates green (target ≥ 279)
- New gate `check:todays-action-engine` enforces the entire funnel contract.

---

*Decision support, not a guarantee.*
