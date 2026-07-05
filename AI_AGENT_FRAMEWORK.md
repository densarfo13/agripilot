# AI_AGENT_FRAMEWORK.md — Agents as honest facades (Layer 5, Track B design)

**An agent is a declarative facade over existing engines — never a new AI system.** The spec's own
rule ("no duplicate AI systems") is enforced structurally: agents own no models, no databases, no
provider keys. The kernel (Layer 4) routes; engines answer; agents present.

## Agent contract
```
agent = {
  domain,                       // e.g. "disease"
  capabilities: [...],          // questions it can be routed
  engines: [...],               // EXISTING engines it fronts (server-side)
  dataSources: [...],           // stores/feeds with live status
  confidencePolicy,             // when to answer vs. qualify vs. decline
  declinePolicy,                // honest decline text when sources are absent
}
```
Every answer carries: simple farmer-language answer · recommended next action · confidence ·
provenance (which engine/source) — and **declines at confidence 0 rather than guessing**. This is
the proven production pattern (V14 precedent: 3 agents live from real engines, 9 honest declines).

## Roster — 18 agents mapped to reality (2026-07-05)
| Agent | Backing today | Status |
|---|---|---|
| Crop | crop library, regional packs, crop engines | LIVE engines |
| Disease | scan pipeline + curated treatments (organic-first) | LIVE engines |
| Pest | insect adapter + curated knowledge | LIVE engines |
| Weather | live weather + advice engine | LIVE |
| Soil | SoilGrids integration | LIVE (coarse) |
| Translation | i18n columns + `/api/localization` | LIVE |
| Analytics | pilot analytics runtimes | LIVE (internal) |
| Satellite | honest `no_live_feed` stub | DECLINES until imagery feed signed |
| Yield | none | DECLINES — needs ground-truth harvest data + validated model |
| Market | buyer-interest tracking only | Partial — declines price questions (no live feed) |
| Funding | directory + eligibility (advisory) | Partial — never says "approved" |
| Insurance | none | DECLINES — licensed partner only |
| Government / NGO | portal data, program directories | Partial |
| Compliance | none | DECLINES — multi-country regs are an external corpus |
| Learning | outcome chains, streaks | Partial |
| Voice | MVP built on `feature/farroway-jarvis-mvp` (flag-off) — input modality, not an agent brain | see `VOICE_PLATFORM.md` |
| Enterprise | tenant/org primitives | Partial |
| Logistics | none (transport/warehousing need real partners) | DECLINES — partner-dependent |

Aliases seen in specs: "Plant Doctor" = Disease agent · "FarmBrain" (as an agent) = the kernel
itself, not a roster entry — it routes, it doesn't answer.

## Kernel routing (Layer 4, exists in pieces today)
Planner → chooses agent(s) by intent · Retriever → knowledge layer/graph · Policy engine → honesty
+ consent + tenancy gates (exist as build/runtime gates; become runtime middleware) · Safety engine
→ Plant Safety Engine is the template (server-side, drift-gated) · Confidence engine → existing
labels/tones · Workflow engine → existing task chains. **Unification = naming these seams, not
rebuilding the engines behind them.**

## Hard rules
1. No agent calls a provider directly — server-side adapters only (keys are secrets).
2. No agent answers outside its provenance — a Market agent without a price feed says so.
3. Farmer-facing text passes the same no-internal-terms + i18n gates as every screen.
4. New agent = config + facade + tests; if it "needs" a new model or store, it is not an agent —
   it is a Phase-gated integration per `ROADMAP_2026_2035.md`.
