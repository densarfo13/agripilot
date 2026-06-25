# PROVIDER_ENV_NAME_AUDIT — P0

Exact env names each provider reads (verified in code, not assumed).

| Provider | Reads (canonical → alias) | Where |
|---|---|---|
| plant.id | `PLANT_ID_API_KEY` → `PLANT_API_KEY` | `plantIdProvider.js:100`, `scanInferenceService.js:139` |
| crop.health | `CROP_HEALTH_API_KEY` → `CROP_ID_API_KEY` | `scanCreditMonitor.js`; **no inference adapter** |
| insect.id | `INSECT_ID_API_KEY` (canonical) | `insectProvider.js:182` |
| mushroom.id | `MUSHROOM_ID_API_KEY` | **no reader anywhere** (genuine gap) |

## Aliases (task 7)
- `PLANT_API_KEY` aliases `PLANT_ID_API_KEY` — already resolved (canonical first).
- `CROP_HEALTH_API_KEY` may alias `CROP_ID_API_KEY` — both now read by
  `providerRuntimeStatus.js` (canonical first).
- `INSECT_ID_API_KEY` is canonical for insect.id (no alias).
- `MUSHROOM_ID_API_KEY` — no reader exists; nothing to alias yet.

## The bug this audit fixes
Before this change, `/api/scan/diagnostics` checked **only Plant.id**. It never
read `CROP_HEALTH_API_KEY` or `INSECT_ID_API_KEY`, so the client's
`__scanAcceptanceHealth()` defaulted `cropHealthConfigured`/`insectIdConfigured`
to `false` — **regardless of what Railway had set.** Setting the keys could not
change the result. `providerRuntimeStatus.js` now reads the real env for all
providers and the endpoint surfaces it.
