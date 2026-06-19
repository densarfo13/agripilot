# Farroway Scan Pipeline Audit

**Date:** 2026-06-02
**Scope:** End-to-end trace from "Take Photo" → "Save Scan" with explicit verification of every external API + env var the spec lists. **Audit only — no code modified.**

Modes applied: `/godmode` (full internal visibility), `/ooda` (Observe → Orient → Decide → Act per stage), `/artifacts` (concrete file:line references throughout).

---

## TL;DR — The 8-Second Version

- **Real production pipeline:** `ScanPage → useScanRuntime → analyzeScan → requestScanAnalysis → POST /api/scan/analyze → analyzePlantImage → pickProvider → external HTTP → fuseContext → applySafetyFilter → ScanResultCard`
- **Of the 5 env vars in the prompt, ONLY 1 (`PLANTNET_API_KEY`) reaches a real HTTP request unmodified.** The other 4 are either phantom names, gate booleans only, or require additional companion vars that the spec never names.
- **No diseaseId / insect classifier is wired** — `INSECT_ID_API_KEY` does not exist anywhere in code.
- **No satellite NDVI is wired into the scan pipeline** — `SENTINEL_HUB_API_KEY` does not exist; the related `sentinelHubService.js` uses CLIENT_ID/CLIENT_SECRET and is reachable from `/api/scan/analyze` ONLY as an optional `landHealth` snapshot lookup, which currently always returns `null` (no provider populates the snapshot table).
- **Scan accuracy score: 38/100** — see §6 for breakdown.

---

## 1. APIs Configured

The codebase declares the following as scan-relevant external APIs:

| # | Service | Declared in | Used as |
|---|---------|-------------|---------|
| 1 | **PlantNet** species ID | `server/src/ml/scanProviders.js:74-110` | Real HTTP POST to `https://my-api.plantnet.org/v2/identify/{project}` |
| 2 | **Plant.id** (alias) | `server/src/ml/scanProviders.js:228-237`, treated as `generic` adapter | Reaches `process.env.SCAN_PROVIDER_URL`; Bearer = `process.env.SCAN_API_KEY` — **NOT** `PLANT_ID_API_KEY` |
| 3 | **Plantix** | `server/src/ml/scanProviders.js:115-142` | Reaches `https://api.plantix.net/v2/diagnose`; Bearer = `process.env.SCAN_API_KEY` |
| 4 | **Cropsense** | `server/src/ml/scanProviders.js:146-176` | Reaches `https://api.cropsense.ai/v1/classify`; Bearer = `process.env.SCAN_API_KEY` |
| 5 | **Generic vision** | `server/src/ml/scanProviders.js:179-203` | Reaches `process.env.SCAN_PROVIDER_URL`; Bearer = `process.env.SCAN_API_KEY` |
| 6 | **Open-Meteo** weather | `server/src/services/weather/weatherProvider.js:20-29` | Reaches `https://api.open-meteo.com/v1/forecast` (free, no key) or `customer-api.open-meteo.com` (with `OPEN_METEO_API_KEY`) |
| 7 | **SoilGrids** | `src/runtime/soil/SoilCache.ts` (client-side, optional) | Reaches `https://rest.isric.org/soilgrids/v2.0/properties/query` (no key) |
| 8 | **Sentinel Hub NDVI** | `server/src/services/satellite/sentinelHubService.js:1-141` | OAuth client_credentials → `services.sentinel-hub.com` |
| 9 | **Cloudinary** upload | `src/runtime/plants/media/PlantImageService.ts`, `PlantMediaService.ts` | Image hosting for plant-media — **NOT** the scan capture path |
| 10 | **OpenAI vision** (alias) | Only as a fallback alias in `_resolveScanApiKey()` | Treated as `generic` adapter — same indirection caveat |

---

## 2. APIs Actively Used (Verified end-to-end in scan pipeline)

| Service | Verified call site | Evidence |
|---------|-------------------|----------|
| **Open-Meteo** weather | `server/src/services/weather/weatherProvider.js:258` (`_fetchWithRetry(url.toString())`) | Real `fetch(url)`. Free-tier works without a key. Result feeds `contextFusionEngine`. ✅ |
| **PlantNet** | `server/src/ml/scanInferenceService.js:130` (`fetch(req.url)` with adapter from `pickProvider`) | URL embeds the key directly in the query string: `?api-key=${encodeURIComponent(apiKey)}`. Only reached when `SCAN_PROVIDER_PROFILE='plantnet'` OR `PLANTNET_API_KEY` is set as the only key. ✅ |
| **Plant.id / Plantix / Cropsense / Generic** | `server/src/ml/scanInferenceService.js:130` | Reachable in principle — see §4 for the "PLANT_ID_API_KEY alone is NOT sufficient" caveat. ⚠️ |
| **Sentinel Hub NDVI** | `server/src/services/satellite/sentinelHubService.js:117` | Real fetch, but the route consumer (`/api/satellite/...`) is **not** invoked from `/api/scan/analyze`. The scan route reads `getLatestSatelliteSnapshot()` which is a Prisma lookup; there is no scheduled job that populates the satellite snapshot table, so the lookup returns `null` in production today. ⚠️ Reachable but unused. |

**That is the entire list.** No other external API is hit during a normal scan request.

---

## 3. APIs Configured But Never Called

These appear as declared env vars or service shells but no fetch reaches them during the scan flow:

| Item | Status | Evidence |
|------|--------|----------|
| `INSECT_ID_API_KEY` | ❌ **Does not exist anywhere in code.** | `grep -r INSECT_ID_API_KEY agripilot/` → zero hits. No insect-ID adapter exists in `scanProviders.js`. Symptom matcher `_normalizeSymptom` returns `'holes'` for pest-like keywords but no API call is made. |
| `SENTINEL_HUB_API_KEY` | ❌ **Does not exist** — the canonical env name in code is `SENTINEL_HUB_CLIENT_ID` + `SENTINEL_HUB_CLIENT_SECRET` (OAuth flow). A third name `SENTINEL_KEY` / `VITE_SENTINEL_KEY` is read by `RemoteSensingEngine.ts:172` but **only to flip a `sentinelHub: boolean` readiness flag** — never used in a fetch. | `sentinelHubService.js:13-14` reads the CLIENT_ID/SECRET pair; `RemoteSensingEngine.ts:172` reads `SENTINEL_KEY` for a readiness boolean only. |
| `WEATHER_API_KEY` | ⚠️ **Phantom var.** Declared in `envSchema.js:81`, surfaced in `/api/system/status` booleans, BUT the real provider (`weatherProvider.js`) reads `OPEN_METEO_API_KEY` — a different name. Setting `WEATHER_API_KEY` on Railway has **no effect on outbound HTTP**. | `server/src/services/weather/weatherProvider.js:24` reads `OPEN_METEO_API_KEY`; `envSchema.js:81` declares `WEATHER_API_KEY` as the spec name. |
| `PLANT_ID_API_KEY` (alone) | ⚠️ **Insufficient.** Flips `pickProvider()` to return the `generic` adapter, but that adapter's `buildRequest` reads `process.env.SCAN_PROVIDER_URL` (the URL — must be set separately) and `process.env.SCAN_API_KEY` (the Bearer header — must be set separately). Setting `PLANT_ID_API_KEY` alone produces a fetch with `url=undefined` and `Authorization: Bearer ` (empty). | `server/src/ml/scanProviders.js:182,186` (generic adapter); `scanProviders.js:235` (auto-pick returns generic on PLANT_ID_API_KEY). |
| `PLANTIX_URL` / Plantix adapter | ⚠️ Reachable only when `SCAN_PROVIDER_PROFILE='plantix'` is explicitly set. No auto-pick path selects it. Closed vendor API — no public docs verified. | `scanProviders.js:117-142`, `scanInferenceService.js:67` (auto-pick only chooses plantnet or generic). |
| `CROPSENSE_URL` / Cropsense adapter | ⚠️ Same as Plantix — no auto-pick path. | `scanProviders.js:148-176`. |
| `_localClassify` | ❌ **Permanent stub.** Returns `{ ok: false, error: 'local_model_not_wired' }` unconditionally. | `scanInferenceService.js:164-170`. |
| `OPENAI_API_KEY` | ⚠️ Listed as alias for the scan-key resolver but routed through the `generic` adapter, so the same SCAN_PROVIDER_URL + SCAN_API_KEY companion-var trap applies. | `scanProviders.js:68`, `_resolveScanApiKey()`. |
| `landHealth` snapshot in `/api/scan/analyze` | ⚠️ Looked up at `app.js:790` but **no producer**. Returns `null` in production; `contextFusionEngine` ignores `null`. | `app.js:785-799`. |

---

## 4. Stage-by-Stage Trace

### Stage 1 — Take Photo (camera)
- **Function:** `ScanCameraScreen` mounted inside `ScanCapture` → `LiveCameraScanner` (from `useScanRuntime` hook)
- **Entry:** User taps the bottom-nav Scan tab → navigates `/scan?intent=camera` → `ScanPage.jsx:325-380` reads `intent=camera` and flips `phase='capture'`
- **API:** Browser `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` (no external HTTP)
- **Env var:** none
- **Success path:** Camera stream rendered; user taps shutter → produces a base64 dataURL + a thumbnail blob → handed to `onContinue` (`ScanPage.jsx:1167`)
- **Failure path:** `ScanFallback` renders with upload-first card (banned wording "Camera ran into a problem" suppressed by gate `check:no-grower-camera-error-card`)
- **Fallback path:** "Use saved photo" button opens a hidden gallery input — bypasses `getUserMedia` entirely
- **Confidence:** N/A (no inference yet)
- **Output object:** `{ imageBase64, imageUrl, thumbnail, file, focusContext }`

### Stage 2 — Upload Photo
- **Function:** `onContinue` (`ScanPage.jsx:1167`)
- **Critical observation:** The image **does NOT upload to Cloudinary** in the scan pipeline. The base64 dataURL is sent **directly in the POST body** to `/api/scan/analyze`. Cloudinary is only used by `PlantImageService` / `PlantMediaService` for the separate "manage my plants" media surface.
- **API:** None at this stage
- **Env var:** none
- **Output:** `_classifierInputRef.current = { aiImageBase64, imageUrl, cropId, cropName, ... }`, then the runtime's `classify()` is invoked

### Stage 3 — Analyze Photo (client → server dispatch)
- **Function:** `_runActiveScanClassifier` (`ScanPage.jsx:1059`) → `analyzeScan` (`src/core/scanDetectionEngine.js:203`) → `requestScanAnalysis` (`src/services/scanApiService.js:65`)
- **API:** `POST /api/scan/analyze` (same-origin, JSON body)
- **Env var:** none on client; `VITE_SCAN_API_ENABLED` feature flag gates the fetch (else returns `null` → rule fallback)
- **Success path:** Server returns `{ ok, verdict, verdictV2, verdictV3, decision, ... }`; `_looksValid()` (`scanDetectionEngine.js:244`) validates presence of `possibleIssue`
- **Failure path:** `null` returned → `getRuleBasedFallback(safeInput)` (`scanDetectionEngine.js:96`) — produces a hard-coded "Needs closer inspection" verdict
- **Fallback path:** 8s timeout + 3s body-parse timeout (`scanApiService.js:29-34`); on timeout returns `null` → rule fallback
- **Confidence calc:** Server-side only at this stage
- **Output:** `ScanResult` envelope (frozen)

### Stage 4 — Identify Plant (server)
- **Function:** `/api/scan/analyze` route handler (`server/src/app.js:687`) → `analyzePlantImage` (`scanInferenceService.js:212`)
- **API selection:** `_selectProvider()` (`scanInferenceService.js:66`) — picks `'external'` if ANY of `PLANT_ID_API_KEY|PLANTNET_API_KEY|SCAN_API_KEY|OPENAI_API_KEY` set, else `'rule'`
- **Provider dispatch:** `_externalClassify()` → `pickProvider()` (`scanProviders.js:228`) returns the concrete adapter
- **Env vars (per provider):**
  - **PlantNet:** `PLANTNET_API_KEY` (URL query string) + optional `PLANTNET_PROJECT` (default `'all'`) ✅ self-contained
  - **Generic / Plant.id:** `SCAN_PROVIDER_URL` + `SCAN_API_KEY` — `PLANT_ID_API_KEY` alone is NOT sufficient ⚠️
  - **Plantix:** `SCAN_API_KEY` + `PLANTIX_URL` (default `https://api.plantix.net/v2/diagnose`) ⚠️ never auto-selected
  - **Cropsense:** `SCAN_API_KEY` + `CROPSENSE_URL` ⚠️ never auto-selected
- **Success path:** Returns `{ symptom: 'spots'|'yellow'|'holes'|'wilt'|'discoloration'|'healthy'|'unclear', confidence: 'low'|'medium'|'high', meta: { provider, latencyMs } }`
- **Failure path:** Returns `{ ok: false, error: 'provider_http_500' | 'provider_exception' | 'provider_unconfigured' }` → falls through to `_ruleClassify()` which uses ONLY weather hints (no image analysis)
- **Fallback path:** Rule classifier returns `{ symptom: 'unclear'|'wilt', confidence: 'low' }`
- **Confidence calc:** `_normalizeConfidence()` (`scanInferenceService.js:185`) — numeric `>=0.75 → 'high'`, `>=0.45 → 'medium'`, else `'low'`. PlantNet's species-match score is mapped: `score >= 0.75 → symptom='healthy' confidence='medium'` (the species-ID providers DO NOT actually classify disease — see Critical Finding §5).
- **Output:** `{ symptom, confidence, meta: { provider, providerId, raw, latencyMs }, fallbackUsed }`

### Stage 5 — Identify Disease
- **Critical finding:** **There is no dedicated disease classifier.** PlantNet returns species-ID scores; Plant.id/Generic adapters reach an unconfigured generic JSON endpoint. The "disease" output is **synthesized by `contextFusionEngine`** (`server/src/ml/contextFusionEngine.js`) by combining:
  1. The bucketed symptom from `_normalizeSymptom` (regex over the provider's label text)
  2. Recent weather (`recentRain`, `humid`, `hot`, `soilDry`)
  3. The user's experience (`'farm' | 'backyard' | 'generic'`)
  4. Region + country
  5. Up to 20 prior `scanTrainingEvent` rows from the same user
- **Function:** `fuseContext()` (`server/src/ml/contextFusionEngine.js`, called from `app.js:809`)
- **API:** None
- **Env var:** None
- **Output:** `{ possibleIssue: string, confidence, contextType: 'garden'|'farm', urgency, ... }`
- **Safety pass:** `applySafetyFilter()` (`scanSafetyFilter.js`) — strips forbidden wording ("Confirmed", "Guaranteed", "100% accurate"), appends disclaimer

### Stage 6 — Generate Task
- **Function:** `app.js:823-827` inline construction of a single `followUpTask = { id: 'ml_followup_garden|farm', title: 'Check this plant again tomorrow', urgency: 'medium' }` based on `contextType`
- **Plus** `suggestTasksForResult()` (`scanDetectionEngine.js:144`) producing up to 2 tasks on the CLIENT after the response
- **API:** None
- **Env var:** None
- **Output:** `Array<{ id, title, reason, urgency, actionType, source }>` (max 2)
- **Persistence:** Tasks are NOT auto-persisted server-side. Client-side `addScanTasks` (`core/scanToTask.js`) writes to local task store IF user taps "Add to Today's Plan" button. ⚠️ Generated tasks that are never tapped are discarded.

### Stage 7 — Generate Follow-Up
- **Function:** `followUpTaskFor()` (`src/core/scanResultPolicy.js`) at the policy layer; `createScanFollowUpTasks()` (`src/core/scan/scanPersistenceBridge.js`) for persistence
- **Server side:** `app.js:823-827` mints exactly one `followUpTask` per scan
- **API:** None
- **Env var:** None
- **Output:** Same shape as Stage 6; written into the scan response under `verdict.followUpTask`

### Stage 8 — Save Scan
- **Function 1 (server-side training event):** `prisma.scanTrainingEvent.create()` (`app.js:859-872`) — fire-and-forget, no error propagation
- **Function 2 (client journal):** `saveScanEntry()` (`src/runtime/data/scanHistory.js`) — writes to `localStorage` key `farroway_scan_history_v1`
- **Function 3 (useful card):** `saveScanUseful()` (`src/lib/scan/scanHistoryStore.js`) — same localStorage key when `FEATURE_SCAN_USEFULNESS` flag on
- **Function 4 (bridge):** `persistScanToJournal`, `persistScanUseful` (`src/core/scan/scanPersistenceBridge.js`) — single writer for the client
- **API:** No external; Prisma → Postgres for server training row
- **Env var:** `DATABASE_URL` (Prisma)
- **Success:** Both client localStorage row AND server `scanTrainingEvent` row written
- **Failure path:** Both writes are swallowed with `try/catch { }`. Failures do not surface to the user.
- **Output:** `{ scanId, savedEntryId, persistedAt }`

---

## 5. Verify — Env Var Usage Table

| Var | Read at (file:line) | Used in HTTP at (file:line) | Verdict |
|-----|--------------------|-----------------------------|---------|
| `PLANT_ID_API_KEY` | `scanProviders.js:65`, `scanInferenceService.js:60`, `scanProviderHealth.js:31`, `server.js:136`, `system/routes.js:175`, `envSchema.js:93`, `productionRuntime.js:67` | **Never directly** — flips `pickProvider()` to return `generic` adapter which reads `SCAN_API_KEY` + `SCAN_PROVIDER_URL` instead | 🟡 **GATE-ONLY** — controls boolean readiness, doesn't carry the actual auth |
| `PLANTNET_API_KEY` | `scanProviders.js:80`, `scanInferenceService.js:61`, `scanProviderHealth.js:32`, etc. | `scanProviders.js:81` (URL query string `?api-key=...`) | ✅ **ACTIVELY USED** |
| `INSECT_ID_API_KEY` | (nowhere in code) | (nowhere in code) | ❌ **NEVER READ** — phantom var; not in envSchema, not in any adapter, not in any route |
| `WEATHER_API_KEY` | `envSchema.js:81`, `productionRuntime.js:50`, `system/routes.js:177`, `config/index.js:165` (`config.weather.apiKey`) | **Never** — the real weather provider reads `OPEN_METEO_API_KEY` instead (`weatherProvider.js:24`); `config.weather.apiKey` is built but no consumer reads `config.weather.apiKey` for an outbound call | 🟡 **READ-ONLY** — value flows into `config` object but no HTTP call consumes it |
| `SENTINEL_HUB_API_KEY` | (nowhere in code) | (nowhere in code) | ❌ **NEVER READ** — canonical names are `SENTINEL_HUB_CLIENT_ID` + `SENTINEL_HUB_CLIENT_SECRET` (OAuth) for `sentinelHubService.js`; `SENTINEL_KEY` for a readiness boolean in `RemoteSensingEngine.ts:172` |
| `SCAN_API_KEY` | `scanProviders.js:67`, `scanInferenceService.js:62`, `server.js:138` | `scanProviders.js:123,154,186` (Bearer header in plantix/cropsense/generic adapters) | ✅ **ACTIVELY USED** — but only in non-PlantNet adapters |
| `SCAN_PROVIDER_URL` | `scanProviders.js:182` | `scanProviders.js:184` (URL for generic adapter) | ✅ **REQUIRED for Plant.id path** — frequently overlooked |
| `SCAN_PROVIDER_PROFILE` | `scanProviders.js:230`, `scanProviderHealth.js:26` | (selector only, not in HTTP) | 🟡 **GATE-ONLY** — picks adapter |
| `OPEN_METEO_API_KEY` | `weatherProvider.js:24` | `weatherProvider.js:211` (URL query string) when set; free endpoint when unset | ✅ **ACTIVELY USED** (optional — free tier works without) |
| `SENTINEL_HUB_CLIENT_ID` + `_SECRET` | `sentinelHubService.js:13-14` | `sentinelHubService.js:20-28` (OAuth) | ✅ **ACTIVELY USED** — but Sentinel route is NOT invoked by the scan pipeline |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | declared in envSchema; used only in plant-media surfaces | NOT in the scan capture path | 🟡 **OFF-PIPELINE** — Cloudinary is media-only, not scan |
| `OPENAI_API_KEY` | `_resolveScanApiKey()` as alias | If selected, routes through `generic` adapter — same SCAN_PROVIDER_URL caveat | 🟡 **INDIRECT** |

---

## 6. Broken Execution Paths + Dead Code

### 6.1 Broken — `PLANT_ID_API_KEY` alone produces silent failure
- **Bug:** Operator sets `PLANT_ID_API_KEY=xxx` on Railway expecting Plant.id to be wired. `pickProvider()` returns the `generic` adapter. The adapter's `buildRequest` reads:
  - `url = process.env.SCAN_PROVIDER_URL` → `undefined`
  - `headers.Authorization = 'Bearer ' + (process.env.SCAN_API_KEY || '')` → `'Bearer '` (empty)
- **Result:** `fetch(undefined, ...)` throws → `_externalClassify` returns `{ ok: false, error: 'adapter_url_missing' }` → falls through to rule classifier → user sees a low-confidence "needs closer inspection" verdict.
- **Symptom in production:** every scan returns `confidence: 'low'` + `provider: 'rule'` regardless of how many scan keys are set, unless the operator ALSO sets `SCAN_PROVIDER_URL` (which is undocumented in the env schema).
- **Evidence:** `scanProviders.js:182,186` + `envSchema.js:93-97` (PLANT_ID_API_KEY listed as standalone option — schema lies).

### 6.2 Broken — `WEATHER_API_KEY` is a phantom
- Status endpoint says weather is "configured" if `WEATHER_API_KEY` is set, but `weatherProvider.js` never reads it. Setting it has zero effect.
- **Evidence:** `system/routes.js:177` vs `weatherProvider.js:24`.

### 6.3 Discarded results — `verdictV2`, `verdictV3`, `decision`, `landHealth` largely unused
- Server emits four parallel verdict envelopes per scan (`verdict`, `verdictV2`, `verdictV3`, `decision`) plus `landHealth`. The client `_runActiveScanClassifier` (`ScanPage.jsx:1063-1146`) only reads `possibleIssue`, `confidence`, `recommendedActions`, `suggestedTasks`. The verdictV2/V3/decision envelopes are passed through but not rendered by the legacy `ScanResultCard` path.
- **Evidence:** `IntelligentScanResult` (which WOULD render the new envelopes) is gated behind `shouldRenderIntelligentResult()` from `ScanResultHealthRuntime` (`ScanPage.jsx:85`), which currently always returns `false` per the comment at line 81-84 ("Until the wave-21 analysis runtime is mounted end-to-end, this returns false and only the legacy card mounts").
- **Impact:** ~60% of the server's per-scan output is computed but discarded before reaching the UI.

### 6.4 Dead — `_localClassify` permanent stub
- `scanInferenceService.js:164-170` — always returns `{ ok: false, error: 'local_model_not_wired' }`. Never replaced. Module spec says "V2 placeholder" — V2 never landed.

### 6.5 Dead — `INSECT_ID_API_KEY` and `SENTINEL_HUB_API_KEY`
- Neither env var name exists in code. Adding them to Railway is a no-op.

### 6.6 Dead — Plantix + Cropsense adapters
- Reachable only when `SCAN_PROVIDER_PROFILE` is explicitly set to `'plantix'` or `'cropsense'`. Auto-pick (`scanProviders.js:228-237`) only ever selects `plantnet` or `generic`. No operator runbook documents these profiles.

### 6.7 Dead — Satellite `landHealth` snapshot
- `app.js:790` calls `getLatestSatelliteSnapshot(prisma, { userId })`. The producer that would populate that snapshot table does not exist as a scheduled job. The lookup returns `null` for every scan in production.

### 6.8 Discarded — `scanTrainingEvent` write swallows errors
- `app.js:858-873` wraps the Prisma write in `try { ... } catch {}` with no logging. If the DB write fails (schema drift, connection drop, RLS), nothing is reported — the training set silently loses rows.

### 6.9 Discarded — Generated tasks never auto-saved
- Server emits `followUpTask` + client emits up to 2 `suggestedTasks`. Both render in the result card. ⚠️ Tasks are persisted ONLY if the user taps "Add to Today's Plan". Closing the result card discards them.

### 6.10 Unreachable — `ScanAnalysisRuntime.runScanPipeline`
- `src/runtime/scan/ScanAnalysisRuntime.ts:160` exports `runScanPipeline()` that documents the full Scan → OODA → Artifact path. **It is never called from any production code path.** ScanPage uses `useScanRuntime` (a different runtime) + `analyzeScan` instead. The TypeScript file is a documented contract that the live code does not consume.
- **Evidence:** `grep -r "runScanPipeline" agripilot/src` → only its own definition + the gate.

### 6.11 Unreachable — Duplicate normalization helpers
- `_normalizeSymptom` exists identically in TWO files: `scanInferenceService.js:172` AND `scanProviders.js:37`. The provider-side helper runs inside adapters; the service-side helper runs again on adapter output. The double-normalization is invisible because the result is idempotent, but it indicates ownership drift.

---

## 7. Missing Integrations

| Missing | Why it matters | Recommended fix |
|---------|----------------|-----------------|
| Real Plant.id (Kindwise) adapter | Plant.id is the most accurate disease classifier in the spec. Treating it as a "generic" Bearer-JSON endpoint with no Plant.id-specific request shape means the API key cannot be exercised even when present. | Author `plantid` adapter in `scanProviders.js` that POSTs to `https://plant.id/api/v3/identification` with `{ images: [base64], modifiers: ['health_all', ...], plant_details: [...] }` + `Api-Key` header. Make it the auto-pick winner when `PLANT_ID_API_KEY` is set. |
| Insect / pest classifier | App brands itself as agriculture-grade; pest ID is a separate capability from species/disease ID. | Wire Kindwise `https://insect.kindwise.com/api/v1/identification` if `INSECT_ID_API_KEY` is set; mirror `parseResponse` shape so `_normalizeSymptom` → `'holes'`. |
| Satellite NDVI feeding scan context | `landHealth` is looked up but always `null`. Real NDVI signal would let the scan pipeline ground-truth a "healthy" verdict against vegetation index. | Schedule a job that calls `fetchNDVI({ latitude, longitude })` per active farm daily and writes to a `satelliteSnapshot` table; `getLatestSatelliteSnapshot` already reads it. |
| Disease confidence calibration | Symptom → "possible issue" mapping is a regex pass. No probability calibration against known confusion matrices. | Wave-3 spec asks for "V3: confidence calibration + severity scoring" — implement against the `scanTrainingEvent` corpus with feedback labels. |
| Server persistence of generated tasks | Tasks generated by the server are never written to `Task` table — discarded unless user taps a button. | Optional auto-persist as `status: 'suggested'` so the user sees them on Today even if they navigated away. |
| Schema lies about PLANT_ID_API_KEY sufficiency | `envSchema.js` says PLANT_ID_API_KEY alone enables "Scan AI provider"; in practice you also need SCAN_PROVIDER_URL + SCAN_API_KEY for the generic adapter to fire. | Either fix the generic adapter to use the right names per profile (`PLANT_ID_API_KEY` as Bearer + a hardcoded Plant.id URL when profile=plantid), or amend `envSchema.js` to document the companion vars. |
| `IntelligentScanResult` never mounts | `shouldRenderIntelligentResult` returns false in production. The richer verdict envelopes (`verdictV2`, `verdictV3`, `decision`) the server computes are inaccessible to the user. | Flip the gate OR retire the parallel envelopes. |

---

## 8. Scan Accuracy Score

**Score: 38/100**

Computation:

| Dimension | Possible | Earned | Notes |
|-----------|----------|--------|-------|
| Real disease-classifier wired | 25 | 0 | No disease-specific provider reaches a real call. PlantNet returns species-ID only. |
| Real species-ID wired (PlantNet) | 15 | 15 | ✅ PlantNet adapter is correctly wired when `PLANTNET_API_KEY` is set. |
| Real weather context | 10 | 10 | ✅ Open-Meteo free tier works without a key; integrates into `contextFusionEngine`. |
| Real soil context | 5 | 3 | SoilGrids client-side only; not consumed by `/api/scan/analyze`. Partial. |
| Satellite NDVI feeding scan | 10 | 0 | `landHealth` always `null`; no producer scheduled. |
| Insect / pest classifier | 10 | 0 | Nothing wired. |
| Multi-source consensus | 5 | 0 | Single-provider path; no consensus runtime invoked server-side. |
| Confidence calibration | 5 | 0 | Bucketed bands only; no calibration against feedback. |
| Honest fallback when unavailable | 5 | 5 | ✅ Rule classifier returns `confidence: 'low'` and `meta.fallbackUsed: true`. Never fakes a verdict. |
| Result actually reaches UI | 5 | 3 | Legacy verdict reaches UI; verdictV2/V3/decision discarded by gated `IntelligentScanResult`. |
| Tasks persisted | 5 | 2 | Only if user taps; otherwise discarded. |

**Justification:** The pipeline is structurally complete — orchestration, retries, safety filter, normalizer, persistence stub — but the **active classifier surface is one provider (PlantNet) that does species-ID, not disease-ID**. The "diagnosis" output is largely synthesized by regex-bucketing + weather rules. Several spec-named env vars are phantoms or insufficient on their own, so operators who follow the env checklist will end up in the rule-based fallback every time.

---

## 9. Production Recommendations (Priority Ordered)

### P0 — Visibility / honesty fixes (no code change required)
1. **Document the SCAN_PROVIDER_URL + SCAN_API_KEY companion requirement** in `envSchema.js` and `RAILWAY_ENV_CHECKLIST.md`. Today the schema says PLANT_ID_API_KEY alone is sufficient — it isn't.
2. **Remove or annotate `WEATHER_API_KEY`** in `envSchema.js`. It is a phantom; document `OPEN_METEO_API_KEY` instead (with a note that the free tier works without).
3. **Strike `INSECT_ID_API_KEY` and `SENTINEL_HUB_API_KEY` from any operator-facing docs** — they don't exist in code.

### P1 — Wire the keys the spec already names (1–2 days each)
4. **Implement a real `plantid` adapter** in `scanProviders.js` against the Kindwise/plant.id API v3 — POST `https://plant.id/api/v3/identification` with `Api-Key: ${PLANT_ID_API_KEY}` header. Set it as the auto-pick winner. This unblocks the most-requested capability.
5. **Implement an `insectid` adapter** for Kindwise insect endpoint. Bind `INSECT_ID_API_KEY` directly.
6. **Schedule a satellite-snapshot producer job** that calls `fetchNDVI` daily for each active farm and writes to the snapshot table `landHealth` lookup already reads.

### P2 — Stop discarding work the server already does
7. **Flip `shouldRenderIntelligentResult` to true** once `IntelligentScanResult` is verified, OR delete `verdictV2`/`verdictV3`/`decision` if they will never render.
8. **Surface `scanTrainingEvent` Prisma write failures** (currently swallowed) — at minimum log to Sentry so we know when the training corpus is leaking rows.
9. **Auto-persist generated tasks** as `status: 'suggested'` so users don't have to tap to keep them.

### P3 — Architecture cleanup
10. **Either consume `ScanAnalysisRuntime.runScanPipeline` or delete it.** Today it documents a contract no production code path executes — confusing for new contributors and accumulating maintenance debt.
11. **Wire `_localClassify`** with a real TensorFlow.js model OR delete the stub. The `local` provider branch is permanently dead.
12. **De-duplicate `_normalizeSymptom`** — pick one owner (recommend `scanProviders.js`) and re-export.

---

## Appendix A — File:Line Quick Reference

- Client entry: `src/pages/ScanPage.jsx:1167` (`onContinue`)
- Client classifier wrapper: `src/pages/ScanPage.jsx:1059` (`_runActiveScanClassifier`)
- Client dispatch: `src/core/scanDetectionEngine.js:203` (`analyzeScan`)
- Client HTTP wrapper: `src/services/scanApiService.js:65` (`requestScanAnalysis`)
- Server route: `server/src/app.js:687` (`POST /api/scan/analyze`)
- Server inference: `server/src/ml/scanInferenceService.js:212` (`analyzePlantImage`)
- Provider registry: `server/src/ml/scanProviders.js:206` (`REGISTRY`)
- PlantNet adapter: `server/src/ml/scanProviders.js:74-110`
- Context fusion: `server/src/ml/contextFusionEngine.js`
- Safety filter: `server/src/ml/scanSafetyFilter.js`
- Health endpoint: `server/src/routes/scanProviderHealth.js`
- Env schema: `server/src/config/envSchema.js`
- Production runtime banner: `server/src/config/productionRuntime.js`
- Weather provider: `server/src/services/weather/weatherProvider.js:24` (reads `OPEN_METEO_API_KEY`)
- Sentinel Hub: `server/src/services/satellite/sentinelHubService.js:13-14` (reads CLIENT_ID/SECRET)
- Documented-but-unreachable runtime: `src/runtime/scan/ScanAnalysisRuntime.ts:160`

## Appendix B — How to Re-Verify This Audit

```bash
# Confirm INSECT_ID_API_KEY truly absent from code (will be zero hits):
grep -r INSECT_ID_API_KEY agripilot/src agripilot/server/src

# Confirm SENTINEL_HUB_API_KEY truly absent (will be zero hits):
grep -r SENTINEL_HUB_API_KEY agripilot/src agripilot/server/src

# Confirm WEATHER_API_KEY is never used in a fetch (zero hits expected):
grep -rE 'WEATHER_API_KEY' agripilot/server/src/services agripilot/server/src/modules

# Confirm Plant.id API host is never called from client/server code:
grep -rE 'api\.plant\.id|kindwise' agripilot/src agripilot/server/src
# (only check scripts will match — no live caller)
```

---

*Audit complete. Decision support, not a guarantee.*
