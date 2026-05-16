# Farroway Pilot Onboarding Checklist

Status: pilot operations. Use this checklist when bringing a new
farmer (or a pilot cohort) onto Farroway. It is written for the
field officer / pilot operator running the session, not the farmer.

The goal of onboarding is one thing: the farmer completes a real
scan and sees a real result they trust. Everything else is support.

---

## 1. Before the session (operator prep)

- [ ] Confirm the device has a working camera and a data connection.
- [ ] Confirm https://www.farroway.app loads and shows `Online`.
- [ ] Have the farmer's crop and rough location ready.
- [ ] Decide the farmer's language up front (see step 3).
- [ ] Have a fallback plan if the network drops mid-session — the
      app keeps a manual symptom picker and an offline queue.

## 2. Account + access

- [ ] Farmer signs in (or the operator creates the account).
- [ ] Confirm the farmer lands on the home / daily briefing screen.
- [ ] If approval is pending, note it — the farmer can still scan
      and use core features; approval gates program features only.

## 3. Language

- [ ] Set the farmer's language on first run.
- [ ] Confirm the home screen, scan flow, and a task line all render
      in that language.
- [ ] If a string falls back to English, that is acceptable for the
      pilot — note it as a translation gap, do not block onboarding.
      (Translation coverage is honest and partial; it is not faked.)

## 4. First scan — the core moment

- [ ] Walk the farmer through one real scan on one real plant.
- [ ] Gallery upload and live camera are both valid — let the farmer
      use whichever is easier on their device.
- [ ] Confirm a result appears with a confidence indicator.
- [ ] If confidence is low, confirm the app says so honestly and
      offers the manual symptom picker — do NOT push a guess.
- [ ] If the scan fails, use the manual symptom picker fallback and
      confirm the farmer still reaches guidance.
- [ ] Confirm safety guidance is shown and is never paywalled.

## 5. Daily briefing + tasks

- [ ] Show the farmer the daily briefing.
- [ ] Have the farmer complete (or mark) one task.
- [ ] Show where journal entries are saved after a scan.

## 6. Notifications

- [ ] Confirm the farmer understands notifications are limited and
      operational (weather risk, scan follow-up, task due) — not spam.
- [ ] Confirm the farmer knows where the in-app notification centre
      is, since that is the persistent record.

## 7. Reporting a problem

- [ ] Show the farmer the in-app "Report an issue" flow.
- [ ] Explain that a field officer reviews reports — nothing
      auto-resolves.
- [ ] Operator: log any bug or confusion you saw in the admin issue
      queue with the screen, role, and language.

## 8. After the session (operator follow-up)

- [ ] Record the device + browser used (for the real-device QA log —
      see `docs/qa/REAL_DEVICE_QA_CHECKLIST.md`).
- [ ] Note: did the farmer complete a scan? Did they trust the
      result? One sentence is enough.
- [ ] File any blocker in the admin issue queue with severity set.
- [ ] Check the Pilot Metrics page after a few sessions to confirm
      usage is being recorded.

---

## What NOT to tell the farmer

- Do not promise a diagnosis the scan did not give. Low confidence
  means low confidence.
- Do not present Farroway as a paid product. There is no billing,
  no paywall, and no ads in the pilot — every monetization flag is
  off (`FEATURE_BILLING`, `FEATURE_PREMIUM_INTELLIGENCE`,
  `FEATURE_NGO_SAAS` are all false).
- Do not enable the Farm Copilot beta — it stays dark behind its
  flag for the pilot.

## Success criteria for one onboarding

A pilot onboarding is successful when the farmer has, with their
own hands:

1. signed in,
2. completed one real scan (camera or gallery),
3. seen an honest result, and
4. knows how to report a problem.

If any of those four did not happen, the session is incomplete —
note why and follow up.
