# VOICE_PLATFORM.md — FarmBrain Voice (Layer 7, Track B design — PARKED)

**Status: PARKED by founder decision 2026-07-05** until Scan P0 closes and pilot metrics justify a
new surface (`NEXT_BRANCH_CHECKLIST.md` item D1 — first in line when the gate opens).

## Ruling
Voice is an **input modality routed through the same command layer as touch** — not a chatbot, not
an oracle, not a separate brain. Utterance → intent match → the SAME app action a tap would take.

## Pipeline (honest kernel)
```
mic button → speech-to-text (Web Speech API / on-device where supported)
          → intent matcher (local keyword/pattern table per locale — no cloud NLP dependency)
          → command router → existing action (navigate / start scan / create task / read plan)
          → response card + optional TTS (existing /api/v2/tts)
```
- **Text command field is the universal fallback** — works offline and where STT is unsupported.
- Low confidence → ONE clarifying question, never a guess.
- Multi-language rides the existing 6-locale i18n system; intent tables are locale files subject to
  the same parity gates.

## Command → action map (all existing surfaces)
| Utterance class | Action |
|---|---|
| "Scan my maize / crop" | open Scan |
| "What do I do today?" | Today's plan (+ TTS read-out) |
| "Show my farm / tasks / weather" | navigate |
| "Record harvest" / "Add to journal" | journal entry flow |
| "Find buyers" / "Sell" | Sell surface (tracking-only truths) |
| "Apply for funding" | funding directory + eligibility (advisory; consent before any data share) |
| "Find insurance" | INSURANCE_SEARCH → finance/insurance directory (licensed-partner info only; consent required before any personal-data use; never an approval) |
| "Explain disease" | curated knowledge screen for the last confirmed match — never generated |
| "Translate" / language names | language sheet |
| "Summarize my week" | existing Weekly Review surface (+ TTS read-out) |
| "How much money have I spent?" | Farm Records totals (GATED — exists only after the Farm Records module ships, see master architecture; a real sum of farmer-entered records, never an estimate) |
| anything else | clarifying question + suggested commands |

## Context awareness (Farroway X spec delta, 2026-07-05)
Intent resolution reads the SAME context the app already holds — farm, crop, growth stage, today's
tasks, weather, scan/disease history, language — plus three environmental flags: **permissions**
(voice can never trigger an action the user's role couldn't do by tap), **offline state** (offline →
queue-capable actions only, text fallback prominent), and **telemetry consent** (voice events obey
the same analytics consent as taps). Context loading is read-only composition over the kernel — no
new stores, no behavioral profiling beyond the existing grower memory.

## Voice status states (UI contract — existing design system only, no new visual system)
`Listening · Thinking · Ready · Need clarification · Offline · Error` — every state visibly
distinct in farmer language; Offline auto-switches to the text command field; no spinner dead-ends.

## Privacy & consent (2026-07-05 spec deltas — ship WITH the kernel, not after)
Voice transcripts are user data:
- consent copy + privacy notice before first use (per-locale, gated like all farmer strings)
- **delete command history** control · **disable voice** option (permanent text fallback)
- auth required; no partner/finance/insurance data flows without per-purpose consent
- command history is tenant-isolated and honors graph consent scopes

## Hard rules
1. Voice never *speaks* a diagnosis, price, yield, or approval that the underlying engine wouldn't
   render on screen — same honesty gates, same confidence policy.
2. No AI/provider/internal terms in any spoken or displayed response (existing gates apply).
3. Not mounted on the /scan route's render path; feature-flagged OFF by default.
4. Telemetry (canonical names, analytics v2): jarvis_opened, voice_record_started,
   voice_record_completed, voice_transcription_failed, command_classified, command_routed,
   command_completed, command_failed, spoken_response_played, jarvis_action_clicked.
5. Implementation branch (when the gate opens): `feature/farmbrain-jarvis`, cut from a green
   post-Release master; modules live in `src/domains/{jarvis,voice,commandCenter}/`; same
   isolation rules as this branch.

## External risk (why this is gated, not just sequenced)
STT quality for target accents/languages (sw/ha/tw in field conditions) is unproven; the kernel
ships only with field-tested routing accuracy per locale, else voice erodes trust instead of
building it.
