# Farroway World-Class UX Checklist

Status: world-class quality gate. Run on a real device, as a new
farmer or gardener would — no insider knowledge, no operator help.
The goal of a world-class build is the same as the goal of a calm
build: every screen answers, in plain language and one action,
"what should I do next?"

Companions:
- `docs/qa/REAL_DEVICE_QA_CHECKLIST.md` — the device-matrix gate
- `docs/qa/SIMPLE_FARMER_UX_CHECKLIST.md` — the calm-UX gate
- `docs/qa/LIVE_SMOKE_CHECKLIST.md` — the happy-path smoke

This checklist is the higher bar: not just "doesn't dead-end", but
"feels right".

---

## A. The 10-second test (core comprehension)

- [ ] A new farmer/gardener understands the **Home** screen in 10
      seconds — they can name the one thing to do next without
      reading more than a sentence.
- [ ] They can **scan** without confusion — capture and analysis
      both happen, no manual "Analyze" button anywhere.
- [ ] **Every scan** ends in a useful next step (a recommendation,
      a manual-symptom picker, or a calm "needs review" line).
- [ ] **Weather** is not just a forecast — it tells the farmer
      what to DO ("Rain expected. Skip watering today.").
- [ ] **Notifications** feel useful, never noisy. Two per day, at
      most. No generic "open the app" reminders.
- [ ] **Language** is consistent — no mixed-language screen, no
      visible raw translation keys.
- [ ] **Offline behaviour preserves trust** — a dropped network
      shows a calm "we'll finish when online", never a dead state.
- [ ] Each screen is **calm and action-first** — one primary
      action, secondary actions visually quieter.

## B. Trust wording (must NEVER appear)

- [ ] "Confirmed disease"
- [ ] "Guaranteed yield"
- [ ] "Guaranteed market price"
- [ ] "Exact diagnosis from photo"
- [ ] Permitted hedged words only: possible · likely · needs
      review · monitor · check.

## C. Scan flow — trust-first

- [ ] Analysis auto-starts after capture / gallery upload.
- [ ] The captured photo is visible during analysis (no empty
      black box, no broken-image icon).
- [ ] On low confidence the wording is honest — "possible" /
      "needs review" — never an over-confident verdict.
- [ ] On scan failure the manual symptom picker is offered.
- [ ] The result is saved to Journal automatically.
- [ ] A follow-up task is offered (opt-in, not forced).
- [ ] On a denied camera the gallery path stays fully usable.

## D. Weather → action

- [ ] Home weather card contains a one-line operational insight,
      not a forecast dump.
- [ ] Rain forecast suppresses watering reminders.
- [ ] High heat shifts watering guidance to morning / evening.
- [ ] Frost / mold / drought alerts are calm and specific.

## E. Watering — adaptive, not alarm-only

- [ ] Watering reminders adapt to rain, heat, humidity, and the
      last time the farmer watered.
- [ ] Skip-watering days are clearly explained (not silent).
- [ ] Missed watering yields one calm follow-up, never a spam
      loop.

## F. Notifications

- [ ] No more than 2 push notifications per day.
- [ ] Quiet hours respected — non-critical pushes don't fire late.
- [ ] Push channel is operational only; in-app channel is the
      persistent record.
- [ ] Farmer phrasing ("Irrigate the field") vs gardener phrasing
      ("Water the plants") matches the user's mode.

## G. Memory + continuity

- [ ] Completing a scan, task, or watering visibly updates Home /
      Journal / Progress.
- [ ] The next session feels informed by the last one (recent
      crop, last scan, last watered).

## H. Offline + reconnection

- [ ] On a dropped network, scan / task / journal entries queue
      with calm copy.
- [ ] On reconnect everything syncs once, in order, with no
      duplicates.
- [ ] No data loss after offline → online → reload.

## I. Localization

- [ ] All visible text comes from the localization registry.
- [ ] Crop names match the selected language (crop registry).
- [ ] Untranslated phrases fall back to English (acceptable) —
      no raw keys like `home.title` ever shown.
- [ ] Notifications, scan results, weather cards, watering
      reminders all localize.

## J. Legal + trust

- [ ] `/privacy` / `/terms` / `/disclaimer` / `/data-consent` are
      reachable and readable.
- [ ] Disclaimer language is plain — no legalese where it can be
      avoided.
- [ ] No paywall, no monetization UI surfaces visible to the
      farmer (`FEATURE_BILLING` / `_PREMIUM_INTELLIGENCE` /
      `_NGO_SAAS` all dark).

## K. Admin / NGO readiness

- [ ] Admin access is role-guarded.
- [ ] Farmer list, scan activity, task completion, issue queue,
      and pilot metrics all load and have export or a clean
      placeholder.

---

## Pass criteria

The build is **WORLD-CLASS PILOT READY** when:

1. every box in section A is ticked,
2. no item in section B appears anywhere in the app, and
3. sections C–K have no failing item.

A failure in A or B is a launch blocker — fix before promoting.
A failure in C–K is friction debt — log it in the admin issue
queue, prioritise, but it does not necessarily block a controlled
pilot.
