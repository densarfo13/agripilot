# VOICE_PRIVACY_REPORT.md — Jarvis MVP privacy posture (feature/farroway-jarvis-mvp)

Voice transcripts are user data. The MVP's design makes the strong guarantees structural:

1. **Audio never leaves the device via Farroway.** STT is the browser's on-device Web Speech API;
   there is no Farroway speech endpoint. (Platform note, stated honestly: some browsers implement
   Web Speech via their own vendor service — that is between the user and their browser vendor;
   Farroway neither receives nor stores audio.)
2. **Transcripts never ship.** `jarvisTelemetry` strips `text`/`transcript`/`utterance` fields
   before emitting; only intent names + outcome flags reach analytics (same consent + pipeline as
   every tap event). Verified by test.
3. **Command history is local-only.** localStorage ring (cap 20) on the device; never synced.
   **Delete command history** clears it in one tap (verified by test).
4. **Disable option.** "Turn off Jarvis" flips the per-device flag to 0, takes effect immediately,
   and the App-level gate stops even loading the Jarvis chunk on next start. Default state for
   every device is OFF.
5. **Consent gate for insurance flows.** INSURANCE_SEARCH shows explicit consent copy first
   ("…I need your OK to use your farm details for this") with Continue / Not now; declining
   navigates nowhere. Approval/purchase language is disclaimed to licensed partners.
6. **Privacy notice in the panel**, farmer language, all 6 locales: "Your voice stays on this
   phone. Commands are saved only on this device and you can delete them anytime."
7. **No mutation without explicit action.** Jarvis only navigates; journal entries, sells, and
   language changes are completed by the farmer on the destination screen.
8. **Permissions/offline awareness.** Voice cannot trigger an action the user's role can't do by
   tap (routes land on the same guarded screens); offline switches to text-only mode.
