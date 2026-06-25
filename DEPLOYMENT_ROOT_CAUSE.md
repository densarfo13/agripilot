# DEPLOYMENT_ROOT_CAUSE

Investigation of why `railway up` fails during snapshot upload / before the app
starts. Findings are measured, not assumed — and they do **not** match the
"snapshot too big" hypothesis: the snapshot config is already correct.

## The 7 investigated factors

| # | Factor | Finding |
|---|---|---|
| 1 | Git repo size | `.git` = 61 MB; pack = 47 MB. Normal. |
| 2 | Files uploaded | `.railwayignore` excludes `node_modules` (2.3 GB), `server/node_modules`, `.git`, `dist`, images, `.claude`. **The 2.3 GB of node_modules is NOT uploaded** — the snapshot is lean source. |
| 3 | `.gitignore` / `.railwayignore` / `.dockerignore` | All three exist and are correct. `.gitignore` ignores node_modules/dist/.env; `.railwayignore` keeps the upload lean; `.dockerignore` filters the build context. |
| 4 | Railway CLI version | `railway 4.57.1` — current. |
| 5 | Railway authentication | Logged in as Dennis Sarfo Darko (densarfo@gmail.com). Valid. |
| 6 | Snapshot timeout | Not a size timeout — see root cause. |
| 7 | Deployment logs | `/api/health` = 200, db ok; live deployment `0842a61f` (commit `05d86cbf`). |

## ROOT CAUSE — environmental TLS fault, not the repo

Every `railway up` from this environment fails at the **TLS transport layer**,
before the build starts:

```
error sending request for url (https://backboard.railway.com/.../up)
  client error (SendRequest) → connection error
  received fatal alert: BadRecordMac
```

Corroborating: `curl https://farroway.app` fails with
`CRYPT_E_NO_REVOCATION_CHECK` and only succeeds with `--ssl-no-revoke`. Both are
signatures of a **TLS-intercepting / unstable network layer in this build
environment** corrupting the encrypted stream (`BadRecordMac` = the TLS record's
MAC failed to validate). This is **not** caused by repo size, file count, or
ignore config — the snapshot is already small and the config is already right.

It is therefore an **environment/network problem on the machine running
`railway up`**, not a code or repository problem.

## Secondary findings (real, fixed here)

1. **The deploy script did not retry `railway up`.** A single transient TLS
   `BadRecordMac` aborted the whole deploy. → **Fixed:** retry-with-backoff (up to
   `RAILWAY_UP_RETRIES`, default 4) on transient network/TLS faults; fail-fast on
   genuine errors.
2. **Raw `railway up` was used instead of the supported `npm run deploy:railway`.**
   The script writes `BUILD_SHA` (so `/api/health` reports the real commit instead
   of `gitSha:null`) and **verifies the deployed SHA matches** — which would have
   surfaced the deployment mismatch automatically. → Use `npm run deploy:railway`.
3. **141 root `*.md` report files were in the snapshot** (harmless but needless).
   → **Fixed:** `.railwayignore` now excludes `*.md`, `reports`, `coverage`, caches,
   `*.tsbuildinfo` — a leaner, marginally more resilient upload.

## What actually unblocks the deploy (none is repo size)

1. **Deploy from a clean network** (your machine): `npm run deploy:railway`.
   The TLS fault is specific to this build sandbox.
2. **Or use Railway's GitHub integration** — connect the service to auto-deploy on
   push to `master`. The code is already pushed; this bypasses the CLI upload (and
   its TLS path) entirely. This is the most robust fix for a flaky CLI network.
3. The hardened deploy script will now ride out *transient* TLS blips on its own.

## No application logic was modified
Only deploy tooling + ignore config: `scripts/deploy/deploy-railway.mjs` (retry)
and `.railwayignore` (leaner snapshot).
