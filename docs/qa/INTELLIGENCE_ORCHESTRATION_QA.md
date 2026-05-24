# Intelligence Orchestration QA Checklist

Status: orchestration gate. Run on a real device with the
intelligence orchestrator wired to the Home surface. The goal of
this checklist is to verify the rule "one calm best action,
suppressed conflicts, honest scan-trust gating" holds end-to-end.

Companions: `docs/qa/REAL_DEVICE_QA_CHECKLIST.md`,
`docs/qa/SIMPLE_FARMER_UX_CHECKLIST.md`,
`docs/qa/WORLD_CLASS_UX_CHECKLIST.md`,
`docs/qa/SCAN_PRODUCTION_HARDENING.md`.

---

## A. One-best-action

- [ ] Home shows exactly ONE primary action card.
- [ ] The action carries a calm reason (one sentence, hedged).
- [ ] Urgency is one of low / normal / high — visible without
      scrolling.
- [ ] `bestTime` is rendered as morning / evening / today / now /
      tomorrow — never raw timestamps.

## B. Suppression engine

- [ ] When rain is expected (>=70 %), Home does NOT say "Water
      today" — the watering candidate is suppressed.
- [ ] After completing today's watering, the watering card does
      not reappear within 6 h.
- [ ] An ignored recommendation (3+ dismissals) does not
      reappear as the primary action.
- [ ] Stale recommendations (>24 h) are filtered out.

## C. Scan-trust dependency

- [ ] If the latest scan was an image-invalid recovery (the
      "Photo could not be loaded" banner), Home does NOT surface
      a scan-followup as the primary action.
- [ ] When the latest scan returned `confidenceLabel:
      needs_review`, scan-followup is suppressed in favour of
      the next non-scan candidate.
- [ ] Orchestrator's `confidence` field reads `limited_scan_trust`
      when the recent scan failed — surfaces show a calm
      "scan again for a clearer reading" prompt.

## D. Notification alignment

- [ ] When Home says "Skip watering today", no notification
      says "Water now".
- [ ] No more than 2 push notifications per day.
- [ ] No generic "open the app" reminders.
- [ ] Quiet hours respected (non-critical pushes do not fire late).

## E. Timing engine

- [ ] On hot days (≥30 °C), watering bestTime resolves to
      morning or evening, never midday.
- [ ] On windy / rainy forecasts, "spray" actions resolve to
      tomorrow.
- [ ] After-rain inspections resolve to tomorrow morning.
- [ ] Quiet-hours non-urgent actions push to morning.

## F. Offline behaviour

- [ ] On reconnect, the orchestrator's last-known snapshot still
      renders (no blank Home).
- [ ] Queued task completions sync once on reconnect — no
      duplicates.
- [ ] Stale guidance is allowed (calmer copy), never silent.

## G. Localization

- [ ] All visible orchestrator text comes from the
      translation registry.
- [ ] Crop names match the selected language (crop registry).
- [ ] No mixed-language screen; missing translations fall back
      to English (never to a raw key).

## H. Emotional tone

- [ ] No technical jargon in the primary action card.
- [ ] No raw scores rendered to the farmer.
- [ ] Critical alerts (frost / drought-high) use the urgent
      tone; everyday tasks use gentle / firm.

---

## Pass criteria

The orchestration gate passes when every box in A and C is
ticked. B/D/E/F/G/H failures are friction debt — log them in the
admin issue queue but they do not necessarily block a controlled
pilot unless they reproduce on every test.
