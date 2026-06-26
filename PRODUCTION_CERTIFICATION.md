# PRODUCTION_CERTIFICATION

**Runtime:** railway · canAccessProviderSecrets=true · build unknown

A provider is READY only from a proven live call (auth + schema + parse + SLA +
FarmBrain). `LOCAL_SECRETS_UNAVAILABLE` means the check ran where secrets are not
reachable — it is NOT "keys missing". `NOT_CONFIGURED` is only emitted on Railway
when keyLength === 0. Sentinel Hub is optional and never blocks.

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
