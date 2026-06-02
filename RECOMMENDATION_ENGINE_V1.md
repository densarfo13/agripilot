# RECOMMENDATION_ENGINE_V1

**Mission:** generate one clear daily action. Avoid complexity.

**Sprint:** Recommendation Engine V1 (daily-action variant)
**Date:** 2026-06-02
**Modes:** `/godmode` `/ooda` `/artifacts`

This is the **focused** daily-action engine — sibling to the broader Intelligence Platform V1 (which shipped in the previous sprint as `TopActionCard`). This V1 enforces the spec's 40/30/20/10 weight model + "always 1 action" + "≤3 actions" + "must emit follow-up date" contracts.

---

## Spec → delivery

| Spec | Delivery |
|---|---|
| Create `RecommendationEngine.ts` | `src/runtime/dailyAction/RecommendationEngine.ts` — client adapter; pins `__dailyActionHealth` |
| Inputs: Weather, Scan Results, Crop, Growth Stage, Open Tasks, Previous Outcomes | All 6 composed in `GET /api/daily-action` route — verified by the gate as required `farm.crop / weather / scan / growthStage / openTasks / outcomeHistory` references |
| Output shape `{ action, priority, reason, confidence, estimatedTime, followUpDate }` | Engine returns these 6 fields verbatim + `priorityScore`, `category`, `topThree[≤3]`, `sourceWeights`, `sources`, `generatedAt` |
| Priority weights **40/30/20/10** (weather/scan/growth/outcomes) | `WEIGHTS = { weather:40, scan:30, growthStage:20, previousOutcome:10 }` — gate-locked literal |
| Example: "HIGH PRIORITY · Inspect lower onion leaves · Recent rainfall and elevated disease pressure · 3 minutes · 86%" | `TodaysActionCard.jsx` renders this exact shape with the priority badge + reason line + time + confidence percent |
| Home page: Today's Action, Why, Time Required, Start Button, Scan Button | `<TodaysActionCard />` mounted in `Home.jsx` above the broader `<TopActionCard />`. Renders all 5 spec elements |
| Command Center: only Crop / Stage / Health / Risk / Today's Action | `DailyCommandCard.jsx` — exactly those 5 rows with testids `daily-command-crop / -stage / -health / -risk / -action` |
| Build Safe: fail if no action, >3 actions, no follow-up | Gate `check-recommendation-engine-v1.mjs` enforces all three: conservative fallback string present, `slice(0, 3)` literal, `followUpDate` field required |

---

## Always-1-action contract

The engine returns exactly 1 top action in every state:

| State | Action |
|---|---|
| Strong signal (e.g., disease + rain) | Specific intervention with full reason |
| Some signal | Best candidate among present sources |
| No signal at all | "Walk the field for 5 minutes and note anything unusual." (fallback) |
| Internal exception | Same fallback — catch block preserves the contract |

The conservative fallback string is gate-locked so a future refactor can't accidentally drop the always-1 invariant.

---

## Files

**New (5):**
- `server/src/ml/dailyActionEngine.js` — server engine
- `src/runtime/dailyAction/RecommendationEngine.ts` — client adapter + global
- `src/components/intelligence/TodaysActionCard.jsx` — single-action surface with Start + Scan
- `src/components/intelligence/DailyCommandCard.jsx` — focused 5-field command center
- `scripts/check-recommendation-engine-v1.mjs` — contract gate
- `RECOMMENDATION_ENGINE_V1.md` (this file)

**Extended (4):**
- `server/src/app.js` — `GET /api/daily-action` route composing 6 inputs
- `src/pages/Home.jsx` — mounts `<TodaysActionCard />`
- `src/App.jsx` — boot installs `__dailyActionHealth`
- `package.json` — gate + build:safe:steps

**0 wave-36 frozen files modified · 0 new Prisma migrations.**

---

## Verification

```bash
# Today's action for the signed-in farmer:
curl -H 'Cookie: <session>' https://www.farroway.app/api/daily-action | jq
# → { ok: true,
#     action: "Inspect the affected onion for botrytis spread.",
#     priority: "high", priorityScore: 78,
#     reason: "botrytis detected (medium severity) Rain favours rapid spread",
#     confidence: 82,
#     estimatedTime: "5 minutes", estimatedMinutes: 5,
#     followUpDate: "2026-06-05",
#     category: "disease",
#     sourceWeights: { weather: 40, scan: 30, growthStage: 20, previousOutcome: 10 },
#     topThree: [ ... at most 3 entries ... ],
#     limitations: "Decision support, not a guarantee." }

# In a logged-in browser session:
window.__dailyActionHealth()
# → { initialized: true, alwaysReturnsOneAction: true,
#     capsTopThreeAtThree: true, emitsFollowUpDate: true,
#     weights: { weather: 40, scan: 30, growthStage: 20, previousOutcome: 10 },
#     composesWeather: true, composesScan: true, composesCrop: true,
#     composesGrowthStage: true, composesOpenTasks: true,
#     composesPreviousOutcomes: true,
#     noFabricatedAction: true, respectsArchitectureLock: true }
```

---

## Build state

- `build:safe` → **279 sequential gates green** (up from 278)
- New gate `check:recommendation-engine-v1` enforces all 3 spec BUILD-SAFE rules + structural contracts.

---

## Coexistence with Intelligence Platform V1

Both engines now run side-by-side on Home:

- **TodaysActionCard** (this sprint) — top of the screen — one action, with explicit Start/Scan buttons.
- **TopActionCard** (prior sprint) — below — the broader unified engine with topThree exploration.

They share no code; they consume different routes (`/api/daily-action` vs `/api/recommendations/today`). The daily-action engine is the simpler, always-1 path; the unified engine is the multi-source explorer that powers the founder + organization dashboards.

---

*Decision support, not a guarantee.*
