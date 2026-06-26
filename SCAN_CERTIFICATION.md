# SCAN_CERTIFICATION

**Runtime:** railway · canAccessProviderSecrets=true · build unknown

Run `railway run npm run scan:certify` (or POST /api/admin/scan/certify on
Railway) for live evidence. Readiness is measured at runtime, never inferred from
env vars.

**Overall: NOT_CERTIFIED**

| Provider | Status | Latency | Conf | Auth | API |
|---|---|---|---|---|---|
| plant.id | DEGRADED | — | 0% | false | v3 |
| crop.health | DEGRADED | — | 0% | false | v1 |
| insect.id | DEGRADED | — | 0% | false | v1 |
| mushroom.id | DEGRADED | — | 0% | false | v1 |
| weather | DEGRADED | — | 0% | false | v1 |
| soil | DEGRADED | — | 0% | false | v1 |
| sentinel_hub | DISABLED | — | 0% | false | n/a |

> Keys are configured ✓. Providers stay DEGRADED until a REAL scan proves them — run one scan in the app (plant photo), or `SCAN_API_BASE=<your-app-url> npm run scan:acceptance`, then re-run certify. Live calls accumulate and lift DEGRADED → READY.
