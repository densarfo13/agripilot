# PILOT_LAUNCH_RUNBOOK — Farroway live pilot

Everything below is taken from the actual code (env-var names, commands, endpoints,
SLAs, verdicts). Nothing is invented. Do the steps in order; each has a clear
**GO / NO-GO**. You run the secret-touching steps — Claude cannot (and should not)
see your Railway secrets.

---

## 0. Pre-flight (1 min)
- Current deploy is `b173bdbe`, build:safe green at 356 gates.
- Confirm the Railway service is up: open the app URL, it should load Home.
- You will need: the Railway project linked locally (`railway link`) OR the Railway
  dashboard open, and an **admin** login for the deployed app.

---

## 1. Set the provider keys on Railway (the ONLY hard blocker)

Set these as Railway environment variables (Service → Variables). **Required** keys
gate certification; **optional** keys never block deployment.

| Provider | Powers | Env var (first match wins) | Required? |
|---|---|---|---|
| plant.id | plant / crop identification | `PLANT_ID_API_KEY` (or `PLANT_API_KEY`) | ✅ required |
| crop.health | disease assessment | `CROP_HEALTH_API_KEY` (or `CROP_ID_API_KEY`) | ✅ required |
| insect.id | pest / insect ID | `INSECT_ID_API_KEY` | ✅ required |
| soil (Ambee) | soil moisture / pH | `AMBEE_API_KEY` | ✅ required |
| weather | weather risk | `WEATHER_API_KEY` (or a configured public weather provider) | ✅ required |
| mushroom.id | mushroom ID | `MUSHROOM_ID_API_KEY` | ⚪ optional (never blocks; never claims edible) |
| sentinel_hub | satellite | `SENTINEL_HUB_API_KEY` | ⚪ optional (never blocks) |

> Security: the certify tooling only ever logs **key length + first-6-char
> fingerprint**, never the key. Keys stay server-side.

**GO** when all five required vars are set in Railway and the service has
redeployed. **NO-GO** if any required var is unset — fix before step 2.

---

## 2. Certify providers from Railway runtime truth

Two equivalent ways — pick one:

**A. CLI (from a linked checkout):**
```
railway run npm run scan:certify
```
It prints the runtime context (`isRailway: true | canAccessProviderSecrets: true`),
per-provider key presence (length + fingerprint only), the per-provider status, the
**overall verdict**, and writes `PROVIDER_SCORECARD.md`, `SCAN_CERTIFICATION.md`,
`PRODUCTION_CERTIFICATION.md`.

**B. Admin endpoint (against the running app), as an admin:**
```
POST https://<your-app>/api/admin/scan/certify     (Authorization: admin)
```
Returns `{ runtimeContext, overallVerdict, providers[], nextAction }`.

**Read the verdict honestly:**
- `PRODUCTION_CERTIFIED` — every required provider proved a live call (auth + schema
  + parse + SLA + FarmBrain). **GO.**
- `PARTIALLY_CERTIFIED` / `NOT_CERTIFIED` — at least one required provider failed.
  The per-provider status says why (`AUTH_FAILED` / `CREDITS_EXHAUSTED` /
  `RATE_LIMITED` / `TIMEOUT` / `SCHEMA_INVALID` / `NOT_CONFIGURED`). Fix that
  provider; re-run. **NO-GO.**
- `LOCAL_SECRETS_UNAVAILABLE` — you ran it somewhere the secrets aren't reachable
  (local/sandbox). This is **NOT** "keys missing." Re-run via `railway run` or the
  admin endpoint so it executes inside Railway.
- `NOT_CONFIGURED` on a provider is only emitted **on Railway when keyLength === 0**
  — i.e. that var really is unset. Set it (step 1).

**GO** when overall = `PRODUCTION_CERTIFIED` (mushroom/sentinel may stay optional).

---

## 3. Scan acceptance against the live app
```
SCAN_API_BASE=https://<your-app> npm run scan:acceptance
```
Reads `/api/scan/diagnostics` (shows plant.id / crop.health / insect.id configured +
available) and runs the sample scans, printing per-scan provider / httpStatus /
candidateCount. **GO** when diagnostics show the required providers
`configured=true available=true` and sample scans return candidates (not errors).

---

## 4. Browser smoke (2 min, on the deployed app)
Open the app, then in DevTools console confirm the honest health globals respond:
```
__scanV12Health()        // sections:11, cvNeverFabricated:true, marketNeverFabricated:true
__agentRegistryHealth()  // agents:12, live:3, declinesNeverFabricateConfidence:true
__digitalTwinHealth()    // predictionNeverFabricated:true
__v14CapabilityHealth()  // nothingFabricatedAsLive:true
```
Then do **one real scan** end to end (photo → identification → recommendation with a
Why line). **GO** if it returns an honest result (a confident ID with evidence, or a
clear "not sure → review" — never a fabricated name).

---

## 5. Onboard the pilot farmers
Recommended size: **5–10 farmers** (matches the LIMITED_PILOT / READY_FOR_10_FARMERS
posture). For each:
- [ ] Account created; language set (en/fr/tw/sw/ha — Hindi stays hidden until
      translated, by design).
- [ ] At least one crop + **planting date** entered (planting date is what unlocks
      the honest calendar estimates — age / harvest window / growth velocity).
- [ ] One guided scan completed with them, so they see the result + Why line.
- [ ] They know how to reach a field officer (the declining agents route to a human
      by design — make sure that human exists).

---

## 6. Run the pilot + measure (no fabrication)
- **Daily/ongoing:** the app records real outcomes; `GET /api/admin/scan/reliability`
  gives the 24h provider scorecard (latency p50/p95/p99, error mix, FarmBrain
  acceptance, health score — `NO_DATA` until calls accumulate, never a fake 100).
- **Weekly:** `npm run report:weekly-pilot` generates the weekly pilot report from
  real recorded data.
- **Accuracy:** populate `golden-dataset/manifest.json` with verified images +
  ground truth, then `npm run golden:dataset` to set an accuracy baseline; later
  runs fail on a regression. Until populated it honestly reports **PENDING** — do
  not treat absence of a number as success.

---

## Go / No-Go summary
| Gate | GO condition |
|---|---|
| 1. Keys | all 5 required Railway vars set |
| 2. Certify | overall = `PRODUCTION_CERTIFIED` |
| 3. Acceptance | required providers configured+available; sample scans return candidates |
| 4. Smoke | health globals honest; one real scan returns an honest result |
| 5. Onboard | 5–10 farmers with crop + planting date + a guided scan |
| 6. Measure | weekly report + reliability scorecard reading real data |

When 1–4 are GO, the platform is genuinely live for farmers. 5–6 turn the pilot into
measured evidence — which is the only thing that can lift the honest
`LIMITED_PILOT` verdict to a real one.
