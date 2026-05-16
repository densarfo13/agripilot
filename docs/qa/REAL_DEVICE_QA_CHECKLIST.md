# Farroway — Real Device QA Checklist

Run before promoting a build from soft-launch to controlled pilot.
This is the **manual** gate — the automated gates (`build:safe`,
`npm test`) do not exercise real cameras, real networks, or real
touch input. Tick every row on every device column.

> Companion: `docs/qa/LIVE_SMOKE_CHECKLIST.md` covers the fast
> happy-path smoke. This checklist is the fuller device matrix.

## Device / environment matrix

| # | Check | iPhone Safari | Android Chrome | Desktop Chrome |
|---|-------|:---:|:---:|:---:|
| 1 | App opens, Home renders within 4 s (no white screen) | ☐ | ☐ | ☐ |
| 2 | Add a farm → Home recognises it (no "No farm added") | ☐ | ☐ | ☐ |
| 3 | Add a backyard/garden → mode + vocabulary switch | ☐ | ☐ | ☐ |
| 4 | Weather card shows a real unit (°F US / °C others) | ☐ | ☐ | ☐ |
| 5 | **Camera scan** — capture auto-analyzes (no Analyze button) | ☐ | ☐ | n/a |
| 6 | **Gallery scan** — upload auto-analyzes | ☐ | ☐ | ☐ |
| 7 | Scan result shows the captured photo (no broken-image icon) | ☐ | ☐ | ☐ |
| 8 | Low-confidence scan → manual issue picker works | ☐ | ☐ | ☐ |
| 9 | Manual pick saves to Journal + offers a follow-up task | ☐ | ☐ | ☐ |
| 10 | Camera **denied** → routes to gallery, no dead-end | ☐ | ☐ | n/a |
| 11 | Task completion persists across refresh | ☐ | ☐ | ☐ |
| 12 | Journal entry persists across refresh | ☐ | ☐ | ☐ |
| 13 | Language switch (EN/FR/SW/HA/TW) — no mixed-language screen | ☐ | ☐ | ☐ |
| 14 | Language choice persists across refresh/reopen | ☐ | ☐ | ☐ |
| 15 | Notification permission prompt is user-triggered (never on mount) | ☐ | ☐ | ☐ |
| 16 | In-app notification centre shows the daily briefing | ☐ | ☐ | ☐ |
| 17 | Refresh/reopen — auth session survives, no re-login loop | ☐ | ☐ | ☐ |
| 18 | DevTools console: no Farroway 404s / Invalid-URL / uncaught errors | ☐ | ☐ | ☐ |

## Weak-network / offline pass (run on iPhone Safari + Android Chrome)

| # | Check | Pass |
|---|-------|:---:|
| N1 | Throttle to Slow 3G — Home still renders from cache | ☐ |
| N2 | Go offline — scan a photo → "Saved, we'll finish when online" | ☐ |
| N3 | Offline — complete a task → queued, no error | ☐ |
| N4 | Offline — add a journal entry → queued, no error | ☐ |
| N5 | Reconnect — queued scan/task/journal sync once (no duplicates) | ☐ |
| N6 | No data loss after offline → reconnect → refresh | ☐ |

## Emergency kill-switch drill (verify, then revert)

Pilot ops can disable a subsystem with no deploy via
`localStorage['farroway:flag:KILL_*'] = '1'`:

| # | Check | Pass |
|---|-------|:---:|
| K1 | `KILL_NOTIFICATIONS=1` → daily briefing stops firing | ☐ |
| K2 | `KILL_COPILOT=1` → Copilot launcher does not render | ☐ |
| K3 | `KILL_SCAN` / `KILL_MARKETPLACE` flags resolve via `isKilled()` | ☐ |
| K4 | Clearing the flag restores the subsystem | ☐ |

## Sign-off

- Build / commit under test: `__________`
- Tester: `__________`  Date: `__________`
- All rows pass → **promote to controlled pilot**.
- Any row fails on Scan / Auth / Localization / Offline-sync /
  runtime console → **do NOT promote** (publish-gate rule).
