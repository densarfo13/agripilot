# PILOT_RELEASE_LOCK.md

**Farroway Phase-1 Pilot — Release Lock.** Date: 2026-06-24.
Basis: PILOT_PREMORTEM.md (20-area audit) + SCAN_ACCEPTANCE_TEST.md.
Scope assumption: **farmers-only Phase-1** (marketplace/buyer frozen per
Pilot Mode). One code fix made this cycle (a verified crash); no features.

---

## 🔴 BLOCKERS — must fix before ANY farmer touches it
*(crash / data-corruption / security / total-failure on the farmer path)*

- **None open.** The one true crash found — `ScanCapture.jsx:507` undeclared
  `url` → ReferenceError on the upload-fallback path — was **fixed this
  cycle** (local objectURL, mirrors the sibling handlers; build green).
- Auth boot fail-safe, scan never-throws, and the route-level spec-verdict
  catch mean no other path hard-crashes the farmer.

> Marketplace/buyer (Areas 15-16) would be a 🔴 BLOCKER **if buyers were in
> scope** — three disconnected stores, `/sell`→non-existent `/api/v3/market/*`,
> no buyer self-signup. It is **out of Phase-1 scope** (frozen). **Do not put
> buyers in this pilot.**

---

## 🟠 HIGH RISK — fix before scaling past a supervised pilot
1. **No server backstop for My Plants + scan history (Areas 3, 6).**
   Both are localStorage-only; `scanToManagedPlant` defers server persistence.
   Cache clear / private mode / quota eviction / device switch = **permanent
   loss** of the farmer's plants + scan diary. Directly threatens D1/D7
   retention. *Fix:* wire the existing `register_managed_plant` payload
   (idempotency key already present) + scan-history rows to a server endpoint.
2. **No offline app shell on the target device class (Areas 10, 19).**
   The service worker is killed every boot (to cure stale-bundle white-
   screens). On rural 2G/3G, every cold launch re-downloads the shell →
   blank screen until JS lands; a dropped connection mid-load = nothing
   cached. *Fix:* a minimal precache-shell SW (app shell + last result),
   carefully, without reintroducing the stale-bundle regression.

---

## 🟡 MEDIUM RISK — acceptable for a supervised pilot; track + fix
- **M1 — Twi gate checks presence, not distinctness (Area 9).** 250 Twi
  values byte-identical to English (39 scan) pass as "100%". *Fix:* add a
  distinctness assertion to `check-translations.mjs` + native Twi pass (#211).
- **M2 — Farm Brain unwired (Area 4 / last turn's H1).** "Add plant" doesn't
  feed FarmBrain or the farm timeline; an active farmer can read as "new".
  *Fix:* pass scan/task history into `getFarmBrain`; emit a `crop_added` event.
- **M3 — Task visibility loss (Area 5).** ≤1 scan task/render + same-day
  dedupe silently drop real follow-ups; whole card gated on a separate flag.
- **M4 — DB boot fragility + scanId race (Area 20).** `$connect` fatal-exit
  with no retry (deploy race needs Railway restart); `ScanTrainingEvent.scanId`
  has no `@@unique` → duplicate training rows under concurrency.
- **M5 — Null-farm task leakage (Area 13).** Onboarding-skippers' null-farm
  scan tasks bleed into a real farm once created (no migration).
- **M6 — HEIC inconsistency (Area 17).** Camera path accepts HEIC; the
  upload-fallback panel rejects it (Phase-4 spec) — confusing for iPhone users.
- **M7 — Garden-mode timeline freeze (Area 14).** Silent default-to-farm stops
  garden milestone accrual; no backfill.

---

## 🟢 LOW RISK — polish, non-blocking
- **L1 — Twi voice (Area 8):** Listen on Twi may read English-accented audio
  (no `ak` voice); text always present. Polish: gate Listen on a usable voice.
- **L2 — Web push absent (Area 7):** closed-tab web reminders don't fire;
  in-app bell/banner always carries the message.
- **L3 — Location-blind advice (Areas 11-12):** no nudge when GPS+manual both
  absent; advice degrades honestly (no fake data).
- **L4 — New tw/ha scan translations (#222):** machine-assisted first pass
  pending native review (SCAN_I18N_TRANSLATOR_REVIEW.md). No English leak.
- **L5 — `plants/` lowercase "Unknown plant" fallback:** cosmetic, off the
  scan path.

---

## What is genuinely production-grade (no action)
Authentication (degraded-mode, fail-safe boot), plant scanning (never-throws,
rule floor, serviceUnavailable), iOS Safari (camera FSM + chunk auto-recovery),
GPS (non-blocking), weather (honest null), notifications denial-handling
(never dead-ends). The safety/honesty contracts hold across the board.

---

# FINAL RECOMMENDATION

## 🟡 LIMITED PILOT

**Not yet PHASE-1 READY for broad/unsupervised launch — but safe and valuable
for a small, supervised pilot now.**

**Why not "DO NOT LAUNCH":** there are zero open crash/security blockers on the
farmer path; the core loop (scan → identify → save → tasks → history → voice)
works and degrades honestly. **Why not "PHASE-1 READY":** the two HIGH risks —
no server persistence for the farmer's own data, and no offline shell on the
rural device class — make unsupervised scale premature; both bear directly on
the retention KPIs the pilot exists to measure.

### Run the LIMITED PILOT under these conditions
1. **Farmers only.** Do NOT enroll buyers (marketplace/buyer is dark).
2. **10–20 farmers, field-officer supported**, who can re-onboard a farmer if
   local data is lost.
3. **One device per farmer**, generally **online** (the data + shell gaps both
   bite hardest offline / on cache clear).
4. Confirm live identification first: `GET /api/scan/diagnostics?live=1` →
   `providerConfigured:true`, `live.httpStatus:200`.

### Promote LIMITED PILOT → PHASE-1 READY by closing
- [ ] **H1** — server persistence for My Plants + scan history.
- [ ] **H2** — minimal offline precache shell.
- [ ] **M1** — Twi distinctness gate + native pass.
- [ ] **M2** — Farm Brain / timeline wiring.

### PUBLIC READY additionally requires
- Marketplace/buyer rebuilt on the real `/api/listings` store + buyer signup
  (currently frozen) · M3–M7 closed · web push · offline parity.
