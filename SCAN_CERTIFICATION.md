# SCAN_CERTIFICATION

**Runtime:** sandbox · canAccessProviderSecrets=false · build unknown

Run `railway run npm run scan:certify` (or POST /api/admin/scan/certify on
Railway) for live evidence. Readiness is measured at runtime, never inferred from
env vars.

**Overall: LOCAL_SECRETS_UNAVAILABLE**

| Provider | Status | Latency | Conf | Auth | API |
|---|---|---|---|---|---|
| plant.id | LOCAL_SECRETS_UNAVAILABLE | — | 0% | false | v3 |
| crop.health | LOCAL_SECRETS_UNAVAILABLE | — | 0% | false | v1 |
| insect.id | LOCAL_SECRETS_UNAVAILABLE | — | 0% | false | v1 |
| mushroom.id | LOCAL_SECRETS_UNAVAILABLE | — | 0% | false | v1 |
| weather | LOCAL_SECRETS_UNAVAILABLE | — | 0% | false | v1 |
| soil | LOCAL_SECRETS_UNAVAILABLE | — | 0% | false | v1 |
| sentinel_hub | DISABLED | — | 0% | false | n/a |

> No local provider secrets available. Run live certification inside the Railway runtime: `railway run npm run scan:certify` (from the linked project).
