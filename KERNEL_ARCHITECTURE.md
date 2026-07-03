# Kernel Architecture — ADR + Comparison + Ranked Plan

## ADR: the Kernel exists LOGICALLY; the physical `kernel/` rewrite is declined
Every requested kernel capability already runs, gated, under `src/runtime/*` — the service registry
in PLATFORM_CORE.md is the kernel's table of contents (identity/auth/orgs/tenants/events/
notifications/audit/consent/flags/AI-runtime/observability/config). "Nothing bypasses it" is already
*enforced*, not aspirational: `check:single-brain` (one AI runtime), tenant-isolation gates, the
event spine as the only cross-domain path, consent gating shares. Physically moving ~400 modules
into `kernel/` would: break 408 gate path-assertions, churn every import, destabilize a pilot-ready
app, and improve **zero** farmer or platform outcomes — failing this spec's own final rule.
Standing declines unchanged (recorded with reasons in PLATFORM_CORE + INVESTOR_DUE_DILIGENCE):
workflow/rule engines, payments/escrow, graph tables, search, GraphQL/SDK/CLI (API-first REST
exists; the rest come with the first consumer). Self-healing: shipped for the domain that matters
(ScanRecoveryChain + retry/backoff/queue + launch-ladder auto-revert).

## Honest comparison
**AWS/Stripe/Shopify/Salesforce/Dynamics:** not peers — they are 10k-engineer infrastructure
companies; Farroway *consumes* this layer (Railway/Stripe-class services) rather than competing
with it. Pretending otherwise is a category error. **Ag peers (Deere/FieldView/CropIn/OneSoil/
Apollo):** see COMPETITIVE_ANALYSIS.md — Farroway's real edge is the honesty architecture +
smallholder low-literacy UX + single-brain loop; real deficits are trained models, traction, and
distribution. **Moat:** the trust + labeled-outcome flywheel (starts at pilot farmer #1).

## Ranked improvements — the REAL list (~15; padding to 50 manufactures noise)
| # | Item | Impact | Effort | Risk | Revenue |
|---|---|---|---|---|---|
| 1 | Run the 100-farmer pilot | extreme | days | low | unlocks all |
| 2 | Wire remaining telemetry events | high | low | low | indirect |
| 3 | Capture device perf (first-paint/scan/GPS) | high | low | low | — |
| 4 | Pen-test + dep-scan + upload AV | high | med | low | contract-enabling |
| 5 | First NGO contract | high | med | low | **first revenue** |
| 6 | Market-price feed partner | high | med | low | marketplace live |
| 7 | 2nd identification provider key | med | low | low | reliability |
| 8 | Lender on consent seam | med | med | med | referral revenue |
| 9 | Pinpoint device render-throw (Export Debug JSON) | med | tiny | low | — |
| 10 | Fix 15 react-hooks lint errors (ScanPage helpers) | med | low | med | — |
| 11 | Move ~60 root reports → docs/reports/ (verify gate refs first; force-add) | med | low | med | — |
| 12 | Inline-hex→token completion (4,276 ratcheted) | med | med | low | — |
| 13 | Ghana DPA + MEL/safeguarding doc pack | med | low | low | donor-enabling |
| 14 | Correction-capture UX polish (flywheel intake) | high | low | low | moat |
| 15 | Model v1 from pilot corrections | high | high | med | defensibility |

## Execution roadmap
**90 days:** items 1–4 + 9–11 (pilot weeks 1–2 → read metrics → fix from evidence → first NGO
conversation with real impact numbers). **6mo:** items 5–8, 13–14; READY_FOR_1000 gates. **12mo:**
item 15, insurer pilot, commercial gates, Ghana-wide. **3yr:** 3-country W. Africa, marketplace
take-rate, extraction along documented seams as tiers demand. **10yr:** the compounding version —
distribution partnerships country-by-country on the trust flywheel; the kernel evolves by
extraction, never by rewrite.

*Deliverable map: PLATFORM_FABRIC/EVENT_ENGINE→PLATFORM_CORE+EVENT_CATALOG · AI_RUNTIME→
FARMBRAIN_SPEC · KNOWLEDGE_FABRIC→KNOWLEDGE_GRAPH_FARMBRAIN_REPORT · PAYMENTS/PARTNER→recorded
declines+playbooks · OBSERVABILITY→OBSERVABILITY_GUIDE · SCALING→LOAD_TEST_REPORT plan ·
WORLD_CLASS_PLATFORM→EXECUTIVE_BOARD_REPORT.*
