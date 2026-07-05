# JARVIS_TEST_REPORT.md — Jarvis MVP verification (feature/farroway-jarvis-mvp)

## Unit/behavior tests — `server/src/__tests__/jarvisMvp.test.js`: **13/13 PASS**
| Spec case | Test | Result |
|---|---|---|
| "Scan my plant" routes to Scan | intent SCAN_PLANT → `/scan?mode=camera` | ✅ |
| "What should I do today?" returns FarmBrain task | `/tasks` + REAL first-task line when kernel has it; null (never invented) when it doesn't | ✅ |
| weather command returns weather advice | WEATHER_ADVICE → weather answer + `/home` | ✅ |
| funding command opens Funding | `/funding`, no consent wall | ✅ |
| insurance command requires consent | needsConsent=true + consent copy first | ✅ |
| unknown asks clarification | UNKNOWN below threshold → clarify, no action | ✅ |
| offline falls back to text | voiceAvailable()=false; adapter reports 'unsupported' safely | ✅ |
| no fake approvals | all 11 intents' answers: no approved/guaranteed language | ✅ |
| no fake prices | no currency amounts / per-kg phrasing in any answer | ✅ |
| no internal terms visible | responder+router fallbacks AND all 44 registered EN values: no api/provider/backend/llm/gpt/token/endpoint/classifier | ✅ |
| command history delete works | add → list (newest first) → clear, localStorage-free fallback | ✅ |
| telemetry emitted | canonical event via shared sink; transcript fields STRIPPED; unknown event names dropped | ✅ |
| (extra) flag default OFF | isJarvisEnabled()=false on a fresh device | ✅ |
| (extra) multilingual classify | sw/ha/tw/hi/fr samples route correctly | ✅ |

## Defects caught by these tests before commit (the point of writing them)
1. **Hausa 'rance' (loan) matched inside English 'insuRANCE'**, tying FUNDING with INSURANCE →
   wrong route. Fixed with whole-word matching in the classifier.
2. **Copy-governor gate bug (master-level)**: `/\bNaN\b/i` banned the common Hausa word "nan" —
   three correct new Hausa strings tripped the ratchet, and investigation showed ~the entire
   pre-existing T-ha baseline (~80) was this false positive. Fixed case-sensitively on `master`
   (85e24257); banned-term debt across 6 locales collapsed to 1 (real).

## Gate chain — `npm run build:safe` on the branch: **PASS — 411 steps green**
Includes eslint (rules-of-hooks 0; exhaustive-deps ratchet unchanged at 190), i18n parity for the
44 new keys × 6 locales, copy governor, dead-clicks, the scan render harness (Scan result tree
still renders clean — Jarvis touched no scan-path file), and the production Vite build.
`npm run typecheck`: no such script exists in this repo — stated, not faked.

## Not verified here (honest)
Real-device voice capture (Web Speech quality on target phones/accents) — requires field testing
before the flag is turned on for any pilot device; the text path carries until then.
