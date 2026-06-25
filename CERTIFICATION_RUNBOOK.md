# CERTIFICATION_RUNBOOK

Provider certification is valid ONLY where the provider secrets are reachable
(the Railway runtime, or locally via `railway run`). A plain local run honestly
reports `LOCAL_SECRETS_UNAVAILABLE` — that means "I can't see the keys from here,"
NOT "the keys are missing."

## Run the live certification
**Step 1 — log in**
```
railway login
```
**Step 2 — link the project**
```
railway link
```
**Step 3 — run certification inside the Railway runtime** (injects the secrets)
```
railway run npm run scan:certify
```
> NOT `npm run scan:certify` on its own — without `railway run` there are no
> provider secrets, so every provider reports `LOCAL_SECRETS_UNAVAILABLE`.

Alternatively, as an admin against the deployed app:
```
POST /api/admin/scan/certify
```

**Step 4 — read the scorecard**
```
PROVIDER_SCORECARD.md   (also PRODUCTION_CERTIFICATION.md, SCAN_CERTIFICATION.md)
```

## Step 5 — if a provider fails, check (in order)
| Status | Check |
|---|---|
| NOT_CONFIGURED | the key NAME is set on Railway (length > 0) |
| AUTH_FAILED | the key VALUE is correct (401/403) |
| CREDITS_EXHAUSTED | provider credit balance |
| TIMEOUT | endpoint reachability / SLA |
| SCHEMA_INVALID | response shape / parser |
| FARMBRAIN_REJECTED | the FarmBrain ingestion gate (confidence/plant-known) |

## States
`NOT_RUN · LOCAL_SECRETS_UNAVAILABLE · NOT_CONFIGURED · AUTH_FAILED ·
CREDITS_EXHAUSTED · RATE_LIMITED · TIMEOUT · SCHEMA_INVALID · FARMBRAIN_REJECTED ·
READY · DEGRADED · DISABLED`. Sentinel Hub is optional and never blocks.
