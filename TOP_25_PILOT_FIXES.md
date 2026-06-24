# TOP_25_PILOT_FIXES.md

**Ranked by Impact × Frequency, effort-adjusted.** Sprint #224.
Adoption-risk only — no new features. Drawn from the zero-day simulation
+ #210 pre-mortem + #223 hardening.

**Scoring:** Impact 1–5 (how badly it hurts a farmer) · Frequency 1–5
(how many of 100 hit it) · Effort S/M/L · **Priority = Impact ×
Frequency**. Sorted high→low. Several top items are **ops/config, not
code** — fastest wins.

| # | Fix | Impact | Freq | Effort | Prio | Tier |
|---|-----|:--:|:--:|:--:|:--:|------|
| 1 | **Confirm Plant.id live in prod** — `GET /api/scan/diagnostics?live=1 → 200` before any farmer scans. The hero feature is dead if this isn't green. | 5 | 5 | S (ops) | 25 | 🔴 BLOCKER |
| 2 | **Server-side persistence for My Plants + scan history** (today localStorage-only → silent total loss on cache-clear/new phone). Payload + idempotency key already built; wire to a server endpoint. | 5 | 5 | L | 25 | 🔴 BLOCKER (for 100) |
| 3 | **Minimal service worker for offline app-shell precache** — cold open on rural 2G/offline currently shows a blank/offline page. Shell-only precache, no stale-bundle regression. | 5 | 4 | M | 20 | 🔴 BLOCKER (for 100) |
| 4 | **Twi/Hausa voice fallback** — never speak wrong-language audio; if no Akan/Hausa TTS, narrate in the chosen text + a short spoken English line, or disable with "voice not available in your language yet." | 4 | 4 | S | 16 | 🔴 HIGH (P2) |
| 5 | **No-push retention gap** — wire scheduled **local** notifications on the native build (works offline) and/or web push, so Day-2/Day-7 nudges actually fire. | 4 | 4 | L | 16 | 🔴 HIGH |
| 6 | **Feed Farm Brain + emit a farm-timeline event on plant-add** — today the timeline/brain never receive the added plant → "you're new" to an active farmer. | 4 | 4 | M | 16 | 🟠 HIGH |
| 7 | **Native-review the first-pass Twi/Hausa scan strings** (#222/#223 machine-assisted) + translate the ~190 remaining English-identical app-wide values. | 4 | 4 | L | 16 | 🟠 HIGH (P1/P2) |
| 8 | **OTP resend + clear "code didn't arrive" path** — Twilio SMS to Ghanaian MNOs can stall; today signup dead-ends. | 4 | 3 | S | 12 | 🟠 HIGH |
| 9 | **`ScanTrainingEvent @@unique(scanId)` + real upsert + drop the double-create** — every scan currently risks duplicate rows (race + fire-and-forget double-write). Needs a one-time dedup before the migration. | 3 | 5 | M | 15 | 🟠 HIGH (data) |
| 10 | **Fix phantom `prisma.farm` → `FarmProfile`** so scan farm-signals (coords/soil/growth-stage) actually populate instead of silently failing on every scan. | 3 | 5 | M | 15 | 🟠 HIGH (functional) |
| 11 | **Single canonical onboarding entry** — resolve MinimalFarmSetup vs FastOnboarding; one clear "start here". | 3 | 4 | S | 12 | 🟠 HIGH |
| 12 | **Scan-first nudge** — "Add your farm to unlock daily tasks" for users who scan before creating a farm (today: empty plan forever). | 3 | 3 | S | 9 | 🟡 MEDIUM |
| 13 | **Gate live "Add to My Plants" on confidence ≥70** — close the trust-gate bypass (currently gates on catalog membership only). | 3 | 3 | S | 9 | 🟡 MEDIUM |
| 14 | **Render thumbnail + plant name + confidence** in the local scan-history list (data already stored, just not shown). | 2 | 4 | S | 8 | 🟡 MEDIUM |
| 15 | **Reduce cold-bundle weight** — route-split recharts/leaflet off the farmer hot path; cuts 2G first-paint. | 3 | 4 | M | 12 | 🟡 MEDIUM |
| 16 | **Marketplace decision** — either point Sell sync to the real `/api/listings` server (fix the `/api/v3` 404 + cross-device invisibility) **or hide Sell/Buyer for Phase-1** (recommended: hide). | 4 | 3 | M | 12 | 🟡 MEDIUM |
| 17 | **Migrate null-farm scan tasks** to the new farm on creation — stop cross-context task leakage. | 2 | 3 | S | 6 | 🟡 MEDIUM |
| 18 | **Garden mode integrity (P5)** — persist mode reliably (stop silent reset-to-farm) + backfill timeline on flip. | 3 | 2 | S | 6 | 🟡 MEDIUM |
| 19 | **Consume the `serviceUnavailable` flag in the scan UI** — show "service temporarily unavailable" instead of a generic unclear when the provider is down. | 2 | 2 | S | 4 | 🟢 LOW |
| 20 | **"Older scans hidden" affordance** (or raise the 30-entry local history cap). | 1 | 3 | S | 3 | 🟢 LOW |
| 21 | **Dup-farm guard** — add a unique constraint / DB-level idempotency on farm create (app-level check is TOCTOU). *(Idempotency-key user-scoping bug already fixed #223.)* | 2 | 2 | M | 4 | 🟢 LOW |
| 22 | **Per-user rate limits** on auth/upload (not just per-IP) for shared-NAT (NGO office / school WiFi) users. | 2 | 2 | S | 4 | 🟢 LOW |
| 23 | **Edit-crop prominence** — make changing the wrong crop obvious. | 2 | 2 | S | 4 | 🟢 LOW |
| 24 | **CSP header** (defense-in-depth; helmet CSP currently disabled). *(SSRF + PII-log already fixed #223.)* | 2 | 1 | S | 2 | 🟢 LOW |
| 25 | **Explicit `onDelete` on legacy Application/Farmer subtrees** — data-integrity hygiene (latent, no live hard-deletes today). | 1 | 1 | M | 1 | 🟢 LOW |

## The 5 that decide the pilot

If only five land before farmers touch it: **#1 (verify provider)**,
**#4 (Twi voice fallback)**, **#11 (one onboarding)**, **#13 (save-gate)**,
and either **#16-hide-Sell** (cheap) to remove the J10 dead-end. Those
are all **S-effort** and turn the *supervised 10–30* pilot from "risky"
to "clean." **#2, #3, #5** (persistence, offline shell, push) are the
**L-effort gate to 100 farmers** — not needed for a supervised 10, but
mandatory before unsupervised scale.
