# PRODUCTION_CERTIFICATION

**Runtime:** railway · canAccessProviderSecrets=true · build unknown

A provider is READY only from a proven live call (auth + schema + parse + SLA +
FarmBrain). `LOCAL_SECRETS_UNAVAILABLE` means the check ran where secrets are not
reachable — it is NOT "keys missing". `NOT_CONFIGURED` is only emitted on Railway
when keyLength === 0. Sentinel Hub is optional and never blocks.

**Overall: NOT_CERTIFIED**

| Provider | Status | Latency | Conf | Auth | API |
|---|---|---|---|---|---|
| plant.id | SCHEMA_INVALID | — | 0% | false | v3 |
| crop.health | SCHEMA_INVALID | — | 0% | false | v1 |
| insect.id | SCHEMA_INVALID | — | 0% | false | v1 |
| mushroom.id | SCHEMA_INVALID | — | 0% | false | v1 |
| weather | SCHEMA_INVALID | — | 0% | false | v1 |
| soil | SCHEMA_INVALID | — | 0% | false | v1 |
| sentinel_hub | DISABLED | — | 0% | false | n/a |
