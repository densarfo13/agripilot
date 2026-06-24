# PILOT_PREMORTEM.md

**Farroway Phase-1 Pilot — Production Pre-Mortem.** Date: 2026-06-24.
Method: static code audit (5 parallel sub-audits, file:line evidence) +
prior acceptance test (SCAN_ACCEPTANCE_TEST.md). Assumes Plant.id auth
fixed + deployed (#221b). No features added; readiness only.

Legend — Probability / Impact: H(igh) M(ed) L(ow). Auto-recovery: does the
code self-heal, or is it a dead-end?

---

### 1 — Authentication
- **State:** Password + phone/OTP (Twilio Verify) → 24h HS256 JWT; httpOnly-cookie + Bearer; `tokenVersion` revocation; client **soft-degraded mode** (transient 429/5xx/network keep cached session, only 401-on-refresh logs out). Boot **refuses to start** without `AUTH_SECRET`/`JWT_SECRET` ≥32 chars (fail-safe).
- **Failure:** 24h token expires mid-task on flaky data; a write needing a fresh token can 401 while refresh is rate-limited.
- **Prob/Impact:** M / H (lost field data entry).
- **Mitigation:** degraded-mode gating `api.js:173`; single-flight refresh + backoff `api.js:206`; bootstrap hard-stop `authStartupState.js:51`.
- **Auto-recovery:** Yes for reads (background refresh restores token); writes during the 401 window can silently fail. **Well-hardened overall.**

### 2 — Plant scanning
- **State:** `/api/scan/analyze` auth + rate-limited (60/min); never-throws contract; rule fallback floor; `serviceUnavailable` flag distinguishes provider-down from unknown-plant. Auth fixed #221b (PLANT_API_KEY alias).
- **Failure:** Plant.id **429 quota exhaustion** mid-pilot.
- **Prob/Impact:** M-H / M (degrades, advisory not gating).
- **Mitigation:** `_ruleClassify` floor `scanInferenceService.js:78`; timeout→`provider_timeout`; route catch ships spec verdict, never raw 500 `app.js:1248`.
- **Auto-recovery:** Yes — degrades to "service temporarily unavailable" + explanation. **Solid.**

### 3 — Plant saving
- **State:** Save → `appendManagedPlant` → `localStorage['farroway_managed_plants']` (cap 500, `_safe`-wrapped). `scanToManagedPlant.ts` **explicitly defers server persistence** (`:230-238`).
- **Failure:** **Permanent data loss** — no server copy. Cache clear / private mode / quota eviction / device switch wipes My Plants with no recovery.
- **Prob/Impact:** M / H.
- **Mitigation:** corrupt/quota → `[]`/`false`, never throws; idempotent append.
- **Auto-recovery:** **No** — survives corruption but no backup/sync. **HIGH-risk gap.** Fix: wire the already-built `register_managed_plant` payload (idempotency key present) to a server endpoint.

### 4 — Farm Brain
- **State:** Read-only honest projection. `getFarmBrain` (rich) has **zero callers** — dead in prod. `buildFarmBrain` (CommandCenterDeck) is fed **only `crop`**, never scan/task history → `hasScan/hasActivity` always false.
- **Failure:** an active farmer (20 scans) computes as "new" if any surface gates on `isNew`/`hasActivity`; the intelligence layer is inert. (= last turn's H1: add-plant doesn't feed FarmBrain/timeline.)
- **Prob/Impact:** M / M (no crash, no fabrication).
- **Mitigation:** `_safe` frozen zero-state + honest onboarding next-step.
- **Auto-recovery:** Yes (never blank/crash); **No** for the wiring gap (cannot self-populate). Fix: pass `getScanUsefulHistory()`+`getActiveScanTasks()` into `getFarmBrain`.

### 5 — Task generation
- **State:** `scanToTask` live; `addScanTasks`→`farroway_scan_tasks` (cap 50, 7-day expiry); `dailyIntelligenceEngine` merges **≤1 scan task/render** into a 3-slot plan.
- **Failure:** silent drops — same-day/same-title dedupe collapse; only 1 of N scan follow-ups reaches Today's Plan; whole card gated on a **separate** `FEATURE_DAILY_INTELLIGENCE` flag.
- **Prob/Impact:** M / M (erodes "the app remembers my problem" trust).
- **Mitigation:** never-empty plan (region top-up + honest empty copy `DailyPlanCard.jsx:1020`); expiry self-prune.
- **Auto-recovery:** Partial — plan self-tops-up; deduped/trimmed tasks gone with no "N hidden" note.

### 6 — Timeline / history
- **State:** Two unsynced stores — local `farroway_scan_history_v1` (cap **30**) + server `/api/scan/history` (auth-required, self-hides empty).
- **Failure:** history evaporates on cache clear; server card invisible for new/no-auth users; 30-cap silently drops oldest.
- **Prob/Impact:** H / M-H (the scan diary — a retention asset — silently vanishes).
- **Mitigation:** corrupt→`[]`; idempotent by scanId; cards self-hide vs render broken.
- **Auto-recovery:** **No** durable backstop once local cleared. Same fix as #3 (server persistence).

### 7 — Notifications
- **State:** Client/local-only — Capacitor local-notifications (native) + Web Notification fallback; **records to history first** so the in-app bell/banner always shows. Web-push providers declared but **unimplemented**.
- **Failure:** web-PWA farmer with the tab closed gets no reminder (web can't schedule ahead).
- **Prob/Impact:** M (H for web) / M.
- **Mitigation:** record-first `notificationService.js:73`; denial never blocks (calm amber banner).
- **Auto-recovery:** Yes in-app; No for OS web push (architecturally absent).

### 8 — Voice playback
- **State:** 3-tier (clip → neural TTS for en/fr/sw → browser TTS); Listen button hides when no TTS. `tw→'ak'` mapping.
- **Failure:** Twi farmer taps Listen → silence or **English-accented Twi** (no `ak` voice on device; provider TTS not enabled for tw; relies on missing clips).
- **Prob/Impact:** M (H for Twi) / M (text always present).
- **Mitigation:** button hides when unavailable `IntelligentScanResult.jsx:363`; English-voice fallback.
- **Auto-recovery:** Partial — no "no-Twi-voice → text-only" signal. Polish: gate Listen on a usable voice for the active lang.

### 9 — Twi localization
- **State:** `tSafe` everywhere (3,291 sites / 299 files); strict no-leak → English fallback, never blank. 65 scan keys registered+translated this cycle (#222) + recurrence gate.
- **Failure:** **gate checks presence, not distinctness** — **250 Twi values byte-identical to English** (39 scan) pass as "100%". Any unregistered key app-wide leaks English.
- **Prob/Impact:** H / M (comprehension barrier).
- **Mitigation:** `tSafe.js:148-171` app-wide guard (anti-blank); `check:scan-i18n-registered` (scan-card registration); MythosLanguageGuard (health visibility).
- **Auto-recovery:** No. Fix: add a **distinctness** check to `check-translations.mjs` + native Twi pass (#211 program).

### 10 — Offline handling
- **State:** **Service worker intentionally KILLED every boot** (`forceUiReset.js:440`) to cure stale-bundle white-screens → **no offline app shell.** Offline *data* solid: localStorage scan queue (cap 8, retry 5) + client rule fallback (`hybridAnalyze`, no network).
- **Failure:** (A) cold offline open = blank/browser-offline page; (B) non-ML offline scan throws to a hard error screen though the scan IS queued.
- **Prob/Impact:** A: H / H · B: M / M.
- **Mitigation:** queue auto-drain on reconnect `ScanPage.jsx:997`; `isLikelyOnline` errs toward "try".
- **Auto-recovery:** Yes for queued data on reconnect; **No** for the shell (no SW = nothing to recover to). Deliberate tradeoff — defensible, but costs offline on the rural device class.

### 11 — GPS / location
- **State:** 4 hardened wrappers; **never auto-blocks**; manual country/region fallback; resolves-not-rejects; 5-min cache; insecure-context guard.
- **Failure:** denial + skip manual → weather/region advice runs location-blind, silently degraded.
- **Prob/Impact:** M / M.
- **Mitigation:** non-blocking `FastOnboarding.jsx:605`; manual entry `locationSafe.js:184`.
- **Auto-recovery:** Yes (safe fallback always). Gap: no nudge when both GPS+manual absent. **Solid.**

### 12 — Weather
- **State:** Open-Meteo (no key); 4s timeout + 2 retries + 30-min cache; **honest null, never fake 0** (`'—'` em-dash); `weatherStale` flag threaded to daily plan.
- **Failure:** no location → "unavailable"; risk a farmer reads it as "all clear".
- **Prob/Impact:** M / M.
- **Mitigation:** `weatherHeroIntelligence.js:139` finite-guards; scan fuses weather as optional (no fabrication).
- **Auto-recovery:** Yes (retries + dual cache, null→safe shape). **Solid.**

### 13 — Farm creation
- **State:** Local-first `saveFarm` (uuid, auto-active first farm, `farm_created` event) + server `/v1/farms` (idempotent, offline-queued). Scanning does **not** require a farm.
- **Failure:** skip-onboarding → null-farm scan tasks **leak into every context** (OR short-circuits on falsy id); no daily plan until a farm exists (honest placeholder).
- **Prob/Impact:** M / M.
- **Mitigation:** null-farm honest plan `dailyIntelligenceEngine.js:173`; auto-activate first farm.
- **Auto-recovery:** Partial — creating a farm unblocks the plan, but orphan null-farm tasks aren't migrated.

### 14 — Garden mode
- **State:** localStorage toggle, default **'farm'**; label-only swap (no route rewire).
- **Failure:** silent reset to 'farm' (new device / cleared storage / swallowed quota error) → garden timeline **stops accruing** scan/task milestones (`timelineBridge.js:57,68` early-return when not garden); no backfill.
- **Prob/Impact:** M / M (garden user's progress narrative freezes).
- **Mitigation:** safe label fallback; mode read at event time.
- **Auto-recovery:** Partial — flip back resumes new milestones; missed ones permanently absent.

### 15 — Buyer module
- **State:** Surfaces exist but **mostly dark** — server buyer browse gated `buyMarketplace:false`; **no buyer self-signup** (Register has no role select); only public `/marketplace` (localStorage) is reachable. Health probes report over an **empty in-memory array**.
- **Failure:** a pilot buyer hits a **guaranteed dead-end** — empty listings (cross-device), interest writes to own localStorage + notifies a farmerId not on that device.
- **Prob/Impact:** H / H **if buyers are in pilot scope**.
- **Mitigation:** empty-states never crash; privacy honored (no farmer phone stored).
- **Auto-recovery:** No (no cross-store reconciliation). **Out of scope for a farmers-only Phase-1 (marketplace frozen).**

### 16 — Marketplace listings
- **State:** Farmer `/sell` is complete **as a local-first feature** (validates, idempotent, expiry sweep) but `syncListing` POSTs to **non-existent `/api/v3/market/*`** (server serves `/api/listings`) → 404 → `_backendUnavailable` for the session.
- **Failure:** a listing is visible **only in the creating farmer's browser**; no buyer on any other device sees it. Empty marketplace is the steady state.
- **Prob/Impact:** H / Critical-to-purpose (M for the farmer's own-device UX).
- **Mitigation:** offline-safe optimistic writes; 404-storm guard; privacy enforced.
- **Auto-recovery:** No (real Prisma `/api/listings` store is bypassed). **Frozen per pilot mode — assess, don't build.**

### 17 — Images / uploads
- **State:** `LiveCameraScanner` FSM (iOS 20s deadline, two-tier constraints, gallery escape); `ScanCapture` 12MB cap before encode, HEIC→JPEG normalize, blur/dark preflight; 8s+3s timeouts.
- **Failure (FIXED this turn):** `ScanCapture.jsx:507` referenced an **undeclared `url`** → ReferenceError on the upload-fallback path (camera-unsupported browsers), silently dead-ending the scan. **Fixed** (local objectURL, mirrors sibling handlers). Residual: `onFileChange` rejects HEIC (`:478`, Phase-4 spec) while camera paths accept it — inconsistent (Medium).
- **Prob/Impact:** was M / H → **crash removed**; HEIC-inconsistency M / M.
- **Mitigation:** size cap `:304`; HEIC normalize `:308`; dual timeouts `scanApiService.js:124`.
- **Auto-recovery:** Yes for camera/denial/timeout; HEIC-on-fallback still rejects (spec).

### 18 — Mobile Safari (iOS)
- **State:** **Most hardened area** — camera FSM (`safeCameraBootstrap.js`), HEIC re-encode, ChunkLoadError `_autoRecoverOnce` (cache+SW purge + cache-bust reload), safe-area metas.
- **Failure:** residual = no offline shell (SW killed) → flaky-iOS cold open re-downloads bundle, blank until it lands.
- **Prob/Impact:** L-M / M.
- **Mitigation:** camera FSM `:119`; chunk auto-recovery `LazyLoadErrorBoundary.jsx:76`.
- **Auto-recovery:** Yes for chunk/camera; No for offline-shell. **Lowest risk.**

### 19 — Android Chrome (primary pilot device)
- **State:** Bundle-conscious (manualChunks, lazy i18n columns); web back-button handled. **SW fully disabled** (every-boot kill) → zero runtime caching though manifest advertises installable.
- **Failure:** rural 2G/3G **every cold launch re-downloads the shell** — white screen until JS lands; dropped connection mid-load = nothing cached.
- **Prob/Impact:** H / H (first-open abandonment on the target network class).
- **Mitigation:** chunk splitting `vite.config.js:205`; chunk auto-recovery (shared); SW-kill prevents stale-bundle white-screens.
- **Auto-recovery:** Partial — stale-bundle self-heals; slow-network cold-start has none (offline shell removed).

### 20 — Database integrity
- **State:** Bare `new PrismaClient()` (no pool tuning); boot `$connect` failure → **`process.exit(1)` no retry**; rich unique constraints; **`ScanTrainingEvent.scanId` has NO unique constraint** (findFirst+create emulated upsert = race-prone). Scan persistence **fire-and-forget, never awaited**. `seed.js` prod-guarded.
- **Failure:** DB restart during deploy kills the container (needs external restart); concurrent same-scanId writes → duplicate training rows.
- **Prob/Impact:** M / M (user-facing scan unaffected — fire-and-forget).
- **Mitigation:** fire-and-forget `.catch()` swallow `app.js:1157`; per-query try/catch→`[]`; graceful SIGTERM.
- **Auto-recovery:** Partial — runtime failures self-recover per-request; **boot does NOT** (no `$connect` retry loop). Fix: `$connect` retry-with-backoff + `@@unique` on `scanId`.

---

## Dominant pattern
**Honest contracts, partial wiring.** Every module is `_safe`/frozen/never-throws — no crashes (after the #17 fix), no fabricated data — but durability and cross-module wiring are thin: **My Plants + scan history are localStorage-only with no server backstop**, the **offline shell is deliberately absent**, and **marketplace/buyer is three disconnected stores** (frozen). The farmer-facing scan→identify→save→tasks→voice loop is safe and works; the gaps are data **durability** and **rural-network resilience**, not crashes.

See **PILOT_RELEASE_LOCK.md** for tiered blockers + go/no-go.
