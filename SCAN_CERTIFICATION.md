# SCAN_CERTIFICATION

**Runtime:** railway · canAccessProviderSecrets=true · build unknown

Run `railway run npm run scan:certify` (or POST /api/admin/scan/certify on
Railway) for live evidence. Readiness is measured at runtime, never inferred from
env vars.

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
