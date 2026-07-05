# FARMBRAIN_OS_MASTER_ARCHITECTURE.md — FarmBrain OS v10 (Track B canonical)

**Branch:** `feature/farmbrain-os` — design only. Implementation is gated by
`NEXT_BRANCH_CHECKLIST.md` (all 12 Release criteria + pilot metrics + founder sign-off).
**This is the single canonical Track B architecture.** It supersedes
`FARMBRAIN_OS_ARCHITECTURE.md` (2026-07-05, absorbed) and the legacy vision docs
(`FARMBRAIN_SPEC.md`, `FARMBRAIN3.md`, `FARMBRAIN_OPERATING_MODEL.md`, `ROADMAP_2026_2030.md`,
`ROADMAP_2030.md`, `COMMERCIAL_ROADMAP.md`), which remain as history only.

**Companion specs:** `KNOWLEDGE_GRAPH_SPEC.md` · `AI_AGENT_FRAMEWORK.md` · `MISSION_CONTROL.md`
· `VOICE_PLATFORM.md` · `PARTNER_PLATFORM.md` · `ROADMAP_2026_2035.md`

## Core principles → what they bind to
| Principle | Binding |
|---|---|
| One platform | Farroway PWA + one server; modules are folders, not products |
| One memory | FarmBrainState V1 (event → state → screen) — EXTEND, never fork |
| One intelligence layer | Layer 4 kernel routes to existing engines; no module ships its own AI |
| One knowledge graph | Layer 2 — an index over existing stores first (no duplicate databases) |
| One mission control | Layer 6 — composition over existing signals; owns no data |

## Invariants (inherited from production, non-negotiable at every layer)
1. **Honesty:** no fabricated diagnosis, prices, yields, approvals, or readings. Absent feeds say
   `no_live_feed`. A module without a real data source ships as an honest stub or not at all.
2. **Routing, not generation:** the kernel decides *which existing engine answers*; it does not
   invent agronomy content. Providers/AI internals are never exposed to farmers.
3. **The external-dependency rule:** the v10–v14 audits set the honest ceiling — remaining value is
   EXTERNAL (real usage, feeds, models, partners). Repo code cannot substitute for it.
4. **Shared spine:** every module uses the same identity, graph, memory, audit, telemetry, and
   security model. No duplicate AI systems, databases, or user profiles.
5. **Event-bus only (Farroway X spec, 2026-07-05):** modules communicate through the existing farm
   event bus / kernel events — never point-to-point module imports. A module that reaches directly
   into another module's internals is a rejected design.

## The 12 layers — honest status (production evidence, 2026-07-05)

| Layer | Exists today (honest) | Gap type |
|---|---|---|
| **1 Foundation** | JWT auth (v1+v2), roles/authorize, org onboarding + invites, tenant-isolation primitives, SW offline shell + queues, 6-locale i18n + 20 gates, security headers, AuditRuntime, analytics v2, health composites + client diagnostics | Extension. Caveats: `req.user.id` identity bug (Release W2) and telemetry persistence (W4) must be fixed in Track A first |
| **2 Data Fabric** | Entities exist as separate Prisma stores (scans, farms, seasons, journal, tasks, events…) | Extension: entity-link layer per `KNOWLEDGE_GRAPH_SPEC.md`; NOT a new database |
| **3 FarmBrain Memory** | Scan history, journal, outcome chains, grower memory, streaks | Extension: consent flags + retention policy; depends on W2 (identity) |
| **4 Intelligence Kernel** | Strongest layer: planner (daily plan), context fusion, retriever (knowledge layer), task chains, honesty/trust/policy gates, confidence engine (labels/tones), **Plant Safety Engine** (server-side safety precedent), recommendation engine, provider routing (plant/crop-health/insect/mushroom adapters) | Unification: name the seams, don't rebuild the engines |
| **5 AI Agents** | Engines exist for crop/disease/pest/weather/soil/translation/analytics; others absent or honest stubs | Facade layer per `AI_AGENT_FRAMEWORK.md` — agents are declarative fronts over existing engines, never new AI systems |
| **6 Mission Control** | Command Center Deck, pilot analytics, founder OS page, health composites | Composition per `MISSION_CONTROL.md` |
| **7 Voice** | PARKED (founder, 2026-07-05). TTS exists (`/api/v2/tts`); text command entry trivial | Per `VOICE_PLATFORM.md` — keyword router kernel; on-device STT quality is the external risk |
| **8 Marketplace** | Sell flow + buyer-interest tracking (tracking-only; no fake prices) | External: buyer liquidity, price feeds; contracts/payments/transport/warehousing require partners + regulatory review |
| **9 Financial Cloud** | Funding directory + eligibility engine (advisory; never "approved") | **Regulated zone:** loans/savings/insurance/credit-scoring only via licensed partners with explicit consent-based data sharing. Farroway is not a bank or insurer. Never in-house |
| **10 Public Platform** | REST API + API-health center | Per `PARTNER_PLATFORM.md` — keys, versioning, webhooks, GraphQL read layer, SDK; plugin marketplace LAST (needs a sandboxing model) |
| **11 Enterprise** | NGO dashboards, field-officer views, org onboarding, RBAC primitives | Contract-driven: harden multi-tenant/SSO/white-label against the first paying institution's real requirements |
| **12 Global** | Crop library + regional knowledge packs + curated disease/pest treatments (organic-first); live weather | External: multi-country regulations, climate/carbon programs, IoT, drones, satellite imagery, supply chain — each needs a signed feed, validated model, or regulated partner |

## Module contract (every current and future module)
```
module = {
  identity:   platform user/org ids only (no parallel profiles)
  data:       reads/writes via kernel + graph (no private database)
  intelligence: requests answers from the kernel router (no private model calls)
  audit:      every mutating action → AuditRuntime
  telemetry:  canonical event names → analytics v2
  security:   platform authn/z; tenant isolation; consent checks for shared data
  honesty:    confidence + provenance on every answer; declines when unsure
}
```

## Digital Twin & Farm Records (Farroway X spec deltas, 2026-07-05)
**Digital Twin = a composition over existing stores, not a new system.** Fields/boundaries (GPS),
plants, growth stage, diseases, treatments, tasks, photos, harvests, and the timeline all exist as
production stores today; `src/runtime/farmos13` is the twin's agent foundation. The twin is the
graph-shaped read view of them (per `KNOWLEDGE_GRAPH_SPEC.md`) — it becomes "predictive" only when
sensor/actual-yield ground truth exists (Phase 5). Requested `DIGITAL_TWIN.md` maps here.

**Farm Records — the one genuinely NEW honest module this spec surfaced.** Manual expense/revenue
entry per farm (seed, fertilizer, labor, transport / sales). It fabricates nothing (farmer-entered),
answers "How much have I spent?" truthfully, completes the twin's economic dimension, and is the
REAL prerequisite for any future cash-flow view — a cash-flow *forecast* stays gated behind
accumulated real records (never modeled from nothing). Candidate for Phase 1–2; farmer-facing,
low-risk, high pilot value.

## Isolation contract (unchanged)
Track B lives on this branch only; no shared CI/gate edits; no prod DB migrations; no deploys;
anything that eventually merges arrives feature-flagged OFF and passes the full gate chain.
