# COMMAND_ROUTER_REPORT.md — Jarvis MVP routing table (feature/farroway-jarvis-mvp)

Pure intent → existing-route mapping (`src/domains/jarvis/commandRouter.js`). Every path is a real
route registered in App.jsx. Classification is a local multilingual keyword table with whole-word
matching (a substring bug — Hausa "rance"/loan inside English "insuRANCE" — was caught by the test
suite and fixed before commit). Below `CONFIDENCE_THRESHOLD` the router clarifies, never guesses.

| Intent | Example (any of 6 languages) | Route | Notes |
|---|---|---|---|
| SCAN_PLANT | "Scan my plant" / "piga picha" / "hoto" | `/scan?mode=camera` | Jarvis UI itself never renders on /scan |
| TODAY_TASKS | "What should I do today?" / "nifanye nini leo" / "me zan yi yau" | `/tasks` | + real first task line when the kernel already knows it (never invented) |
| FARM_STATUS | "How is my farm?" / "shamba langu" | `/my-farm` | |
| WEATHER_ADVICE | "When should I water?" / "météo" / "मौसम" | `/home` | weather advice card |
| MARKETPLACE_SELL | "Who is buying tomatoes?" / "sayar" | `/sell` | tracking-only truths; no prices spoken |
| FUNDING_SEARCH | "Find funding" / "ufadhili" | `/funding` | advisory; "approval always comes from the lender" |
| INSURANCE_SEARCH | "crop insurance" / "bima" / "inshora" | `/funding` (finance directory) | **consent-gated** before routing |
| JOURNAL_ADD | "Add this to my journal" / "andika" | `/journal` | farmer saves the entry explicitly |
| LANGUAGE_CHANGE | "Change language to Twi" / "lugha" | `/settings` | change confirmed by the farmer there |
| HELP | "What can you do?" / "msaada" | `/help` | |
| UNKNOWN | anything below threshold | — | clarifying question + 3 suggested commands |

Telemetry per hop: command_classified → command_routed → (jarvis_action_clicked, command_completed)
or command_failed; consent flag included for gated intents. All 11 routes covered by tests.
