# JARVIS_MVP_REPORT.md — Farroway Jarvis MVP (feature/farroway-jarvis-mvp, 2026-07-05)

**Built after the founder's fourth explicit request, on the isolation terms this spec itself set:**
isolated branch, no merge until Scan is stable, P0-verified first, honest kernel only. Production
is untouched — nothing here deploys, and even a future merge changes nothing for farmers until the
per-device flag is deliberately flipped.

## P0 — Scan protection (verified before any Jarvis code)
| Check | Status |
|---|---|
| /api/scan/analyze returns 200 | ✅ proven live this session (multiple 200s incl. a real probe scan) |
| Result renders without React crash | ✅ full result tree renders clean vs the real envelope; rules-of-hooks = 0 |
| Result saves to Activity/Journal | ✅ server-side fixed & verified (W2 identity fix — history 200 with rows) |
| /admin/scan-debug exports diagnostics | ✅ shipped + verified in the live bundle |
| Retry works / no "Scan temporarily unavailable" on device | ⏳ DEVICE-GATED — the operator's one real scan remains the outstanding verification |
| **Structural protection** | Jarvis never renders on /scan; flag default OFF; separate branch; zero scan-path edits |
Per the spec's "stop and fix Scan first": nothing fixable remains on my side — the residual item is
an operator action this branch cannot affect either way.

## What Jarvis MVP is (and is not)
A voice/text **command center** that routes a farmer to the right existing screen with one clear
next action. It is NOT a chatbot: intent matching is a local multilingual keyword table (no cloud
NLP), answers are fixed i18n templates over REAL kernel context, speech-to-text is the browser's
on-device Web Speech API (audio never leaves the device via Farroway), and the spoken reply uses
on-device speechSynthesis. It cannot invent a diagnosis, price, or approval because it has no
generation path — structurally, not just by policy.

## Modules (spec-complete)
`src/domains/jarvis/` — intents (11, multilingual keywords) · intentClassifier (whole-word scoring,
UNKNOWN below threshold) · commandRouter (intent → real routes) · farmContextLoader (read-only
kernel composition + permissions/offline flags) · farmBrainResponder (template answers + one next
action + consent gating) · commandHistory (local-only ring, deletable) · jarvisTelemetry (10
canonical events via the shared sink; transcripts stripped) · jarvisFlags (default-OFF kill switch).
`src/domains/voice/voiceInput.js` — Web Speech adapter, `available()` false ⇒ text fallback.
`src/domains/commandCenter/JarvisDock.jsx` — floating mic FAB + panel: 6 states (Listening /
Thinking / Ready / Need clarification / Offline / Error), text input always present, suggested
actions, recent commands, action card, privacy notice, delete-history, disable. Existing design
idiom, ≥44–48px targets, aria labels, all strings via tSafe (44 keys × 6 locales registered).

## Wiring & isolation
One App.jsx addition beside the existing floating chrome: `JarvisDock` is lazy AND the lazy chunk
is only requested when `localStorage['farroway.jarvis.enabled']==='1'` — flag off (default) means
zero bytes, zero render, zero risk. The dock additionally self-nulls on /scan and re-checks the
flag every render (Turn off Jarvis takes effect immediately).

## Verdict block
```
SCAN_READY:    NO — one device-gated item (operator scan) — unchanged by this branch
JARVIS_READY:  YES as MVP on feature/farroway-jarvis-mvp (flag-off, unmerged)
               NO for production (merge gate: Scan stable + founder sign-off)
PILOT_READY:   NO — RELEASE_PLAN scoreboard governs (master)
FILES_CHANGED: 10 new modules + App.jsx (1 lazy mount) + 6 locale columns (+44 keys each)
               + 1 test file + 4 reports — zero scan-path files touched
TESTS_ADDED:   13 (server/src/__tests__/jarvisMvp.test.js) — all passing
BUILD_RESULTS: see commit (jarvisMvp 13/13; eslint src/domains 0 errors 0 warnings;
               deps-ratchet unchanged at 190; build:safe on branch — verdict in commit message;
               `npm run typecheck` does not exist in this repo — stated, not faked)
RISKS:         (1) STT quality for sw/ha/tw accents unproven — field-test before flag-on for
               pilots (text fallback carries until then). (2) Keyword classifier is deliberately
               conservative — expect UNKNOWN→clarify often at first; tune tables from real command
               telemetry, not guesses. (3) Merge to master is BLOCKED until the Scan device
               verification passes, per this spec and the release plan.
```
