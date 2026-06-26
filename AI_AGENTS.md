# AI_AGENTS — v14 Multi-Agent Advisor

Twelve specialists. Each explains **reason · evidence · confidence · alternative**.

| Agent | Basis | Behaviour |
|---|---|---|
| Agronomist AI | live | Stages your crop from the calendar; matches water/feed to the stage |
| Weather Scientist | live | Reads the live forecast → frost/heat/rain/wind risk to act on |
| Soil Scientist | live | Reports moisture/pH/organic from soil data; names a lab test for N/P/K |
| Plant Pathologist | requires_model | Declines (conf 0) — no trained disease model; see a specialist |
| Entomologist | requires_model | Declines — no trained pest model |
| Market Analyst | no_live_feed | Declines — no market price feed (never fabricated) |
| Supply Chain Planner | no_live_feed | Declines — no logistics feed |
| Export Advisor | no_live_feed | Declines — no export/compliance feed |
| Financial Advisor | no_live_feed | Declines — no price/cost feed |
| Carbon Advisor | requires_model | Declines — no certified methodology |
| Biodiversity Advisor | requires_model | Declines — no field-survey data |
| Food Safety Advisor | advisory | Static pre-harvest/hygiene checklist (conf 30, not a certification) |

**Why nine decline:** an "Entomologist AI" with no pest model, or a "Market Analyst"
with no price feed, can only invent — which v14's AI-SAFETY section forbids. So they
say what they'd need and route to a human. **A declining agent that returned a
confident answer would be the lie; confidence 0 is the truth.**
