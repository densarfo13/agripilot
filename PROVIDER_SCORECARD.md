# PROVIDER_SCORECARD

**Runtime:** sandbox · canAccessProviderSecrets=false · build unknown

**Overall: LOCAL_SECRETS_UNAVAILABLE** (score 0)

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
