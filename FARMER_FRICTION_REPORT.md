# FARMER_FRICTION_REPORT.md

**Farroway Farmer Zero-Day Simulation — 5 personas × 10 journeys.**
Sprint #224. Date: 2026-06-24. Adoption-risk only, no feature work.

## Method (honest framing)

This is an **expert experiential simulation**, not live clickthrough
telemetry. I walked each journey as the persona would, and graded the
friction against the app's **actual, verified production behavior**
established over the #210 pre-mortem (20 areas), the #222 scan
acceptance test, and the #223 hardening pass. Where a result depends on
something I cannot observe from here (e.g. whether a specific onion
photo returns a confident species), I say so rather than invent a
result. Severity legend: 🟢 minor · 🟡 real friction · 🔴 likely
abandonment.

## Personas

| # | Persona | Make-or-break dependency |
|---|---|---|
| P1 | Ghana smallholder, **Twi**, 2 acres, maize | Twi text + maize scan accuracy |
| P2 | Pepper farmer, **limited literacy** | **Voice** + icons (cannot read) |
| P3 | Onion farmer | Onion scan accuracy + relevant tasks |
| P4 | Tomato farmer | (best case — Plant.id is strongest on tomato) |
| P5 | Backyard gardener | **Garden mode** integrity |

---

## Journey 1 — Sign up · Create farm · Add crop · Receive first task

**What works:** MinimalFarmSetup is a clean 2-field start (crop +
location); the first farm auto-becomes active; location is non-blocking
(can enter region manually or skip). Phone/OTP login exists (Twilio
Verify).

- 🟡 **CONFUSION** — Two onboarding paths exist (MinimalFarmSetup vs
  FastOnboarding) and a **scan-first** entry lets a user reach `/scan`
  before any farm exists. A farmer isn't told which "start" is canonical.
- 🟡 **FRICTION** — OTP depends on **Twilio SMS reaching a Ghanaian
  number**. If the SMS is slow/undelivered (real on some MNOs), signup
  stalls with no alternative. P2 (low literacy) must read a 6-digit code.
- 🔴 **FAILURE** — If the farmer **skips farm creation**, the daily plan
  shows an honest "Add your farm" placeholder **forever** — they never
  "receive a first task." The first task requires farm + crop first.
- **ABANDONMENT:** 🟡 Med. P2: 🔴 High (text-heavy, code-reading).
  *Mitigation present:* location never blocks; honest placeholder, not a
  crash.

## Journey 2 — Scan plant · Save plant · Generate tasks (the hero loop)

**What works (verified):** Plant.id is now **authenticated** (the P0
env-var fix); camera is a hardened state machine; HEIC accepted; blurry
photos get friendly coaching; an unidentified scan shows an explanation
and **never** "Unknown Plant" / never a Create-Task button.

- 🟡 **CONFUSION** — P3/P4: confident identifications display well, but
  a borderline photo shows **"Needs confirmation"** / **"Scan unclear"**
  (with explanation). Tomato (P4) is Plant.id's strongest crop; **onion
  (P3) and maize-leaf (P1) confidence is genuinely lower** — some real
  scans will land in the review path. This is honest, but a farmer
  expecting a name may read "unclear" as "the app is broken."
- 🟡 **FRICTION** — Save-to-My-Plants works, but the **confidence ≥70
  trust gate is bypassed** on the live "Add to My Plants" button (it
  gates on catalog membership, not confidence). A low-confidence plant
  can still be saved.
- 🔴 **FAILURE (silent, deferred)** — My Plants + scan history are
  **localStorage-only, no server copy**. Clear-data / reinstall / new
  phone = the farmer's whole plant list and scan diary **vanish with no
  recovery**.
- 🟡 Only **1 scan-derived task** surfaces in Today's Plan per render;
  if a farmer scanned 3 problems, 2 follow-ups live only in a side slot.
- **ABANDONMENT:** 🟡 Med. *Hard dependency:* the live provider must be
  green — confirm `GET /api/scan/diagnostics?live=1 → httpStatus:200`
  before any farmer touches it.

## Journey 3 — Complete tasks · Review timeline

- 🟡 **CONFUSION** — Tasks exist in **two stores** (scan-task slot vs
  daily plan). The Farm **Brain/timeline does NOT receive the added
  plant** (it's a read-only projection with no writer), so a farmer who
  just added a plant + did a task can see an **empty timeline / "you're
  new"** despite real activity.
- 🟡 **FRICTION** — Local history is capped at **30 entries**; the
  oldest silently drops with no "older scans hidden" affordance.
- 🔴 **FAILURE** — Timeline integrity: adding a plant emits **no
  farm-timeline event**, so "review my journey" under-reports.
- **ABANDONMENT:** 🟡 Med — "the app forgot what I did" erodes the
  retention surface the pilot exists to measure.

## Journey 4 — Receive notification · Open · Complete recommendation

- 🔴 **FAILURE (architectural)** — Notifications are **in-app only; there
  is no web push**. A web-PWA farmer who closes the tab gets **no
  reminder** while the app is closed. The message only appears on next
  open (in the bell/banner).
- 🟢 Permission denial is handled calmly (never dead-ends; toggles still
  save; "the app still works without them").
- **ABANDONMENT:** 🟡 Med-High — Day-2/Day-7 retention depends on a
  re-engagement nudge that, on web, never fires.

## Journey 5 — Use voice only (P2's primary channel)

- 🔴 **FAILURE for Twi** — Voice maps `tw → 'ak'` (Akan). **Almost no
  device ships an Akan TTS voice**, so playback either falls back to an
  **English-accented voice reading Twi text** or is silent. Provider
  neural TTS is enabled only for en/fr/sw — **not Twi/Hausa**.
- 🟢 The Listen button hides when no TTS exists at all (doesn't look
  broken) — but when *some* voice exists, it speaks the wrong language.
- **ABANDONMENT:** 🔴 **HIGH for P2** — a low-literacy, Twi-only farmer
  is exactly the user who depends on voice, and Twi voice is the weakest
  link. This is the single biggest persona-specific risk.

## Journey 6 — Poor network (rural 2G/3G)

- 🟡 **FRICTION** — Scan analyze has an 8s timeout → falls back to the
  client rule engine (no dead-end). Good.
- 🔴 **FAILURE** — There is **no service worker** (intentionally killed
  every boot to cure a worse stale-bundle bug), so a **cold open on 2G
  re-downloads the whole bundle** → blank/white screen until JS lands;
  a dropped connection mid-load leaves nothing cached.
- **ABANDONMENT:** 🔴 High on first cold-open over a slow link — the
  exact network class the pilot targets.

## Journey 7 — Offline, then reconnect

- 🟢 If the app is **already open**, an offline scan is **queued and
  auto-drains on reconnect** (solid).
- 🔴 **FAILURE** — A **cold offline launch shows the browser offline
  page** — the app shell can't load without network (no SW cache). An
  "installed PWA" that only works online.
- **ABANDONMENT:** 🔴 High for offline-first field use.

## Journey 8 — Wrong crop selected

- 🟡 **CONFUSION** — A farmer who picks the wrong crop at onboarding
  gets crop-wrong daily advice until they fix it; the edit path isn't
  prominent.
- 🟡 **FRICTION** — Null-farm scan tasks (from scan-first use) **leak
  across contexts** and can bleed into a later real farm's plan.
- **ABANDONMENT:** 🟢-🟡 Low-Med (recoverable, no data loss).

## Journey 9 — Failed scan (well-hardened)

- 🟢 Provider unavailable → **"service temporarily unavailable"**
  (distinct from "unknown plant"); blurry → coaching; unidentified →
  explanation + retake/save-for-review, **no Create Task**, never
  "Unknown Plant." This journey is now genuinely safe.
- **ABANDONMENT:** 🟢 Low — *conditional on the live provider being
  authenticated* (verify diagnostics).

## Journey 10 — Harvest workflow (sell)

- 🔴 **FAILURE (cross-device)** — A harvest listing is **localStorage-
  only** and syncs to a **non-existent `/api/v3/market` endpoint (404)**.
  The listing is visible **only on the farmer's own device**; no buyer
  on another device can ever see it, and **there is no buyer self-
  signup**. The three marketplace stores (local / in-memory / server)
  don't share data.
- 🟢 Logging your own harvest locally works.
- **ABANDONMENT:** 🔴 High **if** the pilot value prop includes selling.
  🟢 Low if the pilot is scoped to **agronomy only** (scan + tasks +
  advice) — which is the recommended Phase-1 scope.

---

## Cross-persona abandonment heat map

| Journey | P1 Twi/maize | P2 low-lit/pepper | P3 onion | P4 tomato | P5 garden |
|---|---|---|---|---|---|
| J1 Signup | 🟡 | 🔴 | 🟡 | 🟡 | 🟡 |
| J2 Scan→save | 🟡 | 🟡 | 🟡 | 🟢 | 🟡 |
| J3 Tasks/timeline | 🟡 | 🟡 | 🟡 | 🟡 | 🔴 (garden timeline) |
| J4 Notifications | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| J5 Voice-only | 🟡 | 🔴 | 🟡 | 🟡 | 🟡 |
| J6 Poor network | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 |
| J7 Offline | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 |
| J8 Wrong crop | 🟡 | 🟡 | 🟢 | 🟢 | 🟢 |
| J9 Failed scan | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| J10 Harvest/sell | 🟡 | 🟡 | 🟡 | 🟡 | 🟢 |

**The five recurring killers:** (1) no offline shell on rural networks,
(2) localStorage-only persistence = silent data loss, (3) Twi voice is
hollow for the low-literacy persona, (4) no push = no retention nudge,
(5) cross-device marketplace is a dead-end. The **core scan→identify→
task loop is solid**; the friction is in persistence, network, voice,
and selling — not in the hero feature.
