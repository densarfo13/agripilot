# Simple Farmer UX Checklist

Status: pilot QA. Run this checklist on a real device, as a new
farmer would — no insider knowledge, no explanation from the
operator. The goal is a calm app: every screen has ONE clear next
action, no clutter, no raw scores, no technical wording.

If any item fails, file it in the admin issue queue with the
screen, role, and language — do not "explain it away".

---

## A. The 10-second test (core comprehension)

- [ ] A new farmer understands the **Home** screen within 10
      seconds — what to do next is obvious without reading.
- [ ] They can start a **scan** without confusion.
- [ ] They can **complete a task** easily — the Done button is
      obvious.
- [ ] They can understand a **low-confidence scan result** — it
      says "needs review / possible", not a confusing verdict.
- [ ] They can **switch language** with no mixed-language UI left
      behind.
- [ ] Every screen has **one clear next action**.

## B. One primary action per screen

Each screen below should have a single, obvious primary action —
secondary actions must be visually quieter.

- [ ] **Home** — one primary recommendation. Not a wall of cards.
- [ ] **My Farm / My Grow** — one primary action (update / view).
- [ ] **Tasks** — the next task, with an obvious Done button.
- [ ] **Scan** — take/upload a photo; analysis auto-starts.
- [ ] **Journal** — add or review an entry.
- [ ] **Progress** — view progress; no action overload.
- [ ] **Funding** — one clear "explore / save" action.
- [ ] **Sell** — one clear "list produce" action.
- [ ] **Notifications** — read; each item ties to a real action.

## C. Home clarity

- [ ] Shows ONE primary recommendation.
- [ ] Shows ONE weather / risk insight.
- [ ] Shows ONE task or follow-up.
- [ ] Shows ONE progress / memory cue.
- [ ] No duplicate CTAs, no repeated recommendations.
- [ ] No raw confidence scores or technical model output.

## D. Scan clarity

- [ ] Analysis starts automatically after a photo / upload —
      there is NO manual "Analyze photo" button.
- [ ] The captured image preview is always visible.
- [ ] The result always ends with a useful next step.
- [ ] The result is saved to Journal.
- [ ] A follow-up task is offered.
- [ ] Wording is confidence-aware: "likely / possible / needs
      review" — never "confirmed disease" or "exact diagnosis".
- [ ] On a failed scan, the manual symptom picker is offered.

## E. Tasks clarity

- [ ] Tasks are short and action-first.
- [ ] Each task includes a brief reason — not a long agronomy
      paragraph.
- [ ] The best time to act is shown.
- [ ] The Done button is obvious and easy to tap.

## F. Notification clarity

- [ ] Notifications are useful and low-noise.
- [ ] No more than 2 push notifications per day.
- [ ] No generic "open the app" reminders.
- [ ] Each notification is tied to real farm context (weather,
      a scan follow-up, a task due).
- [ ] Notification text is in the farmer's selected language.

## G. Localization consistency

- [ ] All visible text uses the localization registry — no
      hardcoded strings.
- [ ] Crop names use the crop registry and match the language.
- [ ] No screen shows two languages at once.
- [ ] An untranslated phrase falls back to English (acceptable) —
      it never shows a raw key like `home.title`.

## H. Trust wording (must never appear)

- [ ] No "confirmed disease".
- [ ] No "guaranteed yield".
- [ ] No "guaranteed market price".
- [ ] No "exact diagnosis from photo".
- [ ] Permitted wording only: possible / likely / needs review /
      monitor / check.

---

## Pass criteria

The build passes this checklist when **every box in section A is
ticked** and no item in section H appears anywhere in the app. A
failure in B–G is a friction bug — log it; it is not necessarily
a launch blocker, but A and H are.
