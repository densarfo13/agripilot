# SCAN_PROVIDER_ENV_AUDIT — P0 §3

Method: fingerprint only (first 6 chars + length). **Full key values are never
printed** — the build gate `check:scan-provider-auth` fails if a full key is
logged. Audited `server/.env` (local). Production (Railway) values must be
verified separately by the founder.

| Variable | State | Fingerprint | Length |
|---|---|---|---|
| `PLANT_API_KEY` | **SET** | `PPel5C…` | 50 |
| `PLANT_ID_API_KEY` | UNSET | — | — |
| `CROP_HEALTH_API_KEY` | UNSET | — | — |
| `INSECT_ID_API_KEY` | UNSET | — | — |

## Alias resolution
`PLANT_API_KEY` and `PLANT_ID_API_KEY` are aliases for the same Plant.id key.
The key is present under the **`PLANT_API_KEY`** alias (len 50, `PPel5C…`), so
**Plant.id is configured**. The server diagnostics report both
`plantApiKeyLength` and `plantIdApiKeyLength` so the alias in effect is visible.

## Findings
- **Plant.id** — configured (via `PLANT_API_KEY`). ✅
- **Crop.health** — `CROP_HEALTH_API_KEY` not set. ❌ Provider cannot run.
- **Insect.id** — `INSECT_ID_API_KEY` not set. ❌ Provider cannot run (allowed to
  be gracefully disabled when no insect scan mode is active).

## Required action (founder, on Railway)
1. Confirm `PLANT_ID_API_KEY` **or** `PLANT_API_KEY` is set in the Railway
   environment (verify with `GET /api/scan/diagnostics?live=1` → `httpStatus:200`).
2. Set `CROP_HEALTH_API_KEY` to enable crop-health analysis.
3. Set `INSECT_ID_API_KEY` to enable insect identification.

Until (2) and (3) are done, `__scanAcceptanceHealth()` honestly reports
`cropHealthReady:false` / `insectIdReady:false` — these are **not** faked to true.
