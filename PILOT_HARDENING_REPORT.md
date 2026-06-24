# PILOT_HARDENING_REPORT.md

**Farroway Final Pilot Hardening.** Date: 2026-06-24. Sprint #223.
Objective: make Farroway impossible to embarrass in front of a real farmer.
Method: static audit (security/data sub-audit + the 20-area pre-mortem) +
**fixes applied this cycle**. No new features.

---

## ✅ FIXED THIS CYCLE (was a risk → now closed)

| # | Was | Fix | File |
|---|-----|-----|------|
| F1 | **Crash** — upload-fallback path threw `ReferenceError: url` (camera-unsupported browsers) → scan silently dead-ended | local objectURL, mirrors sibling handlers | `src/components/scan/ScanCapture.jsx` |
| F2 | **SSRF** — server fetched any `imageUrl` incl. `169.254.169.254`/loopback/RFC1918 | private/reserved-range denylist before fetch | `server/src/ml/preprocessImage.js` |
| F3 | **PII in logs** — `farmerName`/`farmName` written to stdout on every farm save | log presence booleans only, never values | `server/routes/farmProfile.js:196` |
| F4 | **Cross-user replay** — idempotency key collapsed to shared `anon:` namespace on all v2 routes (`req.user.sub` undefined) | read `req.user.id ?? req.user.sub` | `server/src/middleware/idempotency.js:42` |
| F5 | **Twi English-leak on primary scan card** — 65 `tSafe` keys unregistered → English in every locale | registered + translated, recurrence gate | `#222` + `check:scan-i18n-registered` |
| F6 | **60 English-identical scan strings in Twi + Hausa** (advice, quality coaching, urgency) — a Twi farmer read English during the scan demo | real Twi + Hausa translations (first-pass) | `T-tw.js`, `T-ha.js` |
| F7 | **No regression guard** for English leakage | `check:i18n-distinctness` ratchet (tw≤175 ha≤157 fr≤316 sw≤212) | new gate in build:safe |

All gate-locked; build:safe green.

---

## 🔴 BLOCKER — must fix before ANY farmer
**None open** on the farmer path. The one crash (F1) is fixed; auth boot is
fail-safe; the scan route never throws a raw 500.
> Marketplace/buyer would be a BLOCKER **if buyers were enrolled** (three
> disconnected stores, `/sell`→non-existent `/api/v3/market/*`, no buyer
> signup). **Out of Phase-1 scope — do not enroll buyers.**

## 🟠 HIGH — fix before scaling to many / unsupervised farmers
- **H1 — No server persistence for My Plants + scan history.** localStorage-
  only; cache clear / device switch = permanent loss. Threatens D1/D7
  retention. *Fix:* wire the existing `register_managed_plant` payload +
  history rows to a server endpoint.
- **H2 — No offline app shell.** Service worker killed every boot; rural
  cold-start re-downloads the bundle (blank until it lands). *Fix:* minimal
  precache shell without the old stale-bundle regression.
- **H3 — Duplicate scan rows.** `ScanTrainingEvent.scanId` has no `@@unique`;
  persister emulates upsert via `findFirst`+`create` (race) AND the route
  double-writes (thin `create` + fire-and-forget update). *Fix:* dedup
  existing rows → add `@@unique([scanId])` → real `upsert` → drop the double
  `create`. (Needs a migration — stage carefully.)
- **H4 — Phantom `prisma.farm` model (functional, error-masked).** The scan
  route calls `prisma.farm.findFirst` but the model is `FarmProfile`; the
  call silently fails every scan, so farm-coord / soil / growth-stage signals
  are always empty. *Fix:* query `farmProfile` with the right shape.
- **H5 — Legacy `Application`/`Farmer` subtrees have no `onDelete`.** Latent
  (no hard-delete path today), but a future delete orphans ~18 child tables.
  *Fix:* explicit `onDelete` on each.

## 🟡 MEDIUM — acceptable for a supervised pilot; track
- **M1 — Per-user rate limits only on scan.** Login/upload/OTP/sell are
  per-IP only → shared-NAT users throttle each other; IP-rotation bypasses.
- **M2 — Farm-dup is app-level TOCTOU**, no backing `@@unique` on `FarmProfile`.
- **M3 — CSP disabled** (`helmet contentSecurityPolicy:false`) — no in-app
  XSS defense-in-depth.
- **M4 — Farm Brain unwired** — "add plant" doesn't feed FarmBrain/timeline;
  active farmer can read as "new".
- **M5 — Task visibility** — ≤1 scan task/render + same-day dedupe silently
  drop real follow-ups.
- **M6 — Null-farm task leakage** across contexts after a farm is created.
- **M7 — HEIC inconsistency** — accepted by camera path, rejected by upload
  panel (Phase-4 spec).
- **M8 — Garden-mode timeline freeze** on silent default-to-farm; no backfill.
- **M9 — fr/sw English-identical debt** (316/212) — ratcheted (can't grow),
  needs native pass.

## 🟢 LOW — polish
- Twi voice (no `ak` TTS → English-accented audio; text always present) ·
  web push absent (in-app bell carries it) · location-blind advice nudge ·
  new tw/ha scan translations are first-pass pending native review · DB boot
  `$connect` no-retry · multi-replica memory-store rate caps · `trust proxy`
  single-hop assumption.

---

## Per-area hardening status (the requested surfaces)
- **Scan flow** (camera perms / upload fallback / slow net / timeout / empty
  response / invalid + large image / duplicate / retry): **hardened.** Never-
  throws, rule floor, `serviceUnavailable`, 12MB cap + magic-byte sniff,
  upload crash F1 fixed. Duplicate-scan ROW issue = H3 (server-side only).
- **Plant save** (dup / missing crop·farm·date / corrupted image / concurrent):
  idempotent append, null-safe, never-throws. Durability gap = H1.
- **Task engine** (no dup / no impossible / stage·weather·crop-aware): dedupe +
  expiry + region-aware; visibility trim = M5.
- **Farm Brain** (no empty states / confidence / memory / timeline): honest
  zero-state, never blank/fabricate; wiring = M4.
- **Localization** (6 langs / no mixed-language / no raw keys / no English
  leak): primary scan card + 60 scan strings now real Twi+Hausa; raw-key
  leak impossible (`tSafe` + registration gate); residual identical-value
  debt ratcheted (M9).
- **Mobile** (iOS Safari / Android Chrome / low-bw / offline): iOS most
  hardened (camera FSM, HEIC, chunk auto-recovery); offline shell = H2.
- **Data** (orphans / FKs / dup scans / dup farms): V2 tree cascades clean;
  H3 (dup scans), H4 (phantom farm), H5 (legacy onDelete), M2 (dup farms).
- **Security** (rate limits / upload validation / API abuse / audit logs):
  strong upload validation + CORS + no SQLi; SSRF F2 fixed, PII F3 fixed,
  replay F4 fixed; residual M1 (per-IP), M3 (CSP).

See **PHASE1_LAUNCH_DECISION.md** for the verdict and **FARMER_DEMO_CHECKLIST.md**
for the live-demo runbook.
