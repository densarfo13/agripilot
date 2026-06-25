# PRODUCTION_CERTIFICATION

**Runtime:** sandbox · canAccessProviderSecrets=false · build unknown

A provider is READY only from a proven live call (auth + schema + parse + SLA +
FarmBrain). `LOCAL_SECRETS_UNAVAILABLE` means the check ran where secrets are not
reachable — it is NOT "keys missing". `NOT_CONFIGURED` is only emitted on Railway
when keyLength === 0. Sentinel Hub is optional and never blocks.

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
