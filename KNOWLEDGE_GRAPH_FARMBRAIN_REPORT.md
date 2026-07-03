# Knowledge Graph + FarmBrain Report

## Unified AI engine — ALREADY BUILT AND GATE-ENFORCED
FarmBrain is the **only** recommendation orchestrator (`check:single-brain` + `check:farmbrain-x`
fail the build on a second one). Its existing contract already matches this spec's §4 exactly:
inputs = scan/weather/crop-stage/farm-profile/task-history/market events (EVENT_CATALOG.md);
outputs = todayPriority / nextBestAction / farmHealth / cropRisk / **explanation (why)** /
**confidenceLabel** (low·medium·high — numeric % is gate-blocked) / evidence. Unknown is allowed
(`no_live_feed`); fabrication is blocked by 17 honesty gates. The spec's farmer-facing example
("Inspect onion leaves today / why / Moderate / Start inspection") is the shipped DecisionHero
contract. **Finance/NGO/government signals join as published events** — the extension rule in
FARMBRAIN_SPEC.md — not as new engines.

## Knowledge graph — honest position
The graph's **semantic core already exists** as the event spine + FarmBrainState: every listed
relationship (FARMER_OWNS_FARM … SCAN_DETECTED_DISEASE … TASK_RECOMMENDED_FOR_CROP) is present as
Prisma relations + domain events that FarmBrain ingests. What does NOT exist is a separate
`knowledge_nodes`/`knowledge_edges` store — **deliberately deferred**:
- A parallel graph store would create a **second source of truth** competing with FarmBrainState
  (the canonical layer this codebase is built around) — the exact duplication the single-brain rule
  forbids.
- No query today needs generic graph traversal; recommendation context is served by
  FarmBrainState + the intelligence fabric.
- **Migration path (agreed design):** when a real traversal need arrives (e.g. cross-farm disease
  spread queries at NGO scale), add `graphEventIngestor` as a **projection** consuming the existing
  event runtime into Postgres nodes/edges tables — a derived read model, never a second writer.
  This is Neo4j-migratable by construction and destroys nothing.

## Net
No new code needed to satisfy the spec's rules (single orchestrator, why/evidence/label, unknown
allowed, auditable) — they are already enforced. The graph tables come with their first real query.
