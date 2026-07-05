# FARMBRAIN_OS_ARCHITECTURE.md — Track B vision (isolated; NOT for implementation until Release exits)

**Branch:** `feature/farmbrain-os`. Nothing here may affect Release (`master`). This is an
architecture document, not a build order. Implementation is gated by `NEXT_BRANCH_CHECKLIST.md`.

## Architectural invariants (non-negotiable, inherited from production)
1. **Extend, never fork, the kernel.** FarmBrain Kernel already exists in production as
   FarmBrainState V1 — the single event → state → screen layer. Every Track B module consumes and
   extends it; no module gets its own parallel state brain.
2. **Honesty gates apply to vision code too.** No fabricated diagnosis, prices, yields, funding
   approvals, or satellite readings. Feeds that don't exist report `no_live_feed` — the production
   contract. A module without a real data source ships as an honest stub or not at all.
3. **Never expose providers.** Farmers see farmer language. Provider/AI/backend terms stay
   server-side (already enforced by the no-internal-terms gates).
4. **Routing, not generation.** The "Unified AI Engine" is a **planner/router**: it decides which
   existing engine answers and composes their outputs. It does not generate agronomy content
   itself, so it cannot fabricate.
5. **The external-dependency rule.** Audits of v10–v14 established the honest ceiling: the code
   side of scan/intelligence is essentially complete; the remaining value is EXTERNAL (real device
   usage, provider keys, data feeds, partnerships, models). Modules below are classified by that
   dependency, because more repo code cannot substitute for it.

## Module map — what exists today vs. what each module actually needs

| Module | Exists today (production, honest) | Missing = external dependency |
|---|---|---|
| FarmBrain Kernel | FarmBrainState V1 (event→state→screen), farmEventBus, continuity engine | Nothing external — extension work only |
| Knowledge Graph | `src/knowledge` curated layer, regional packs, crop library, plant reference | Graph store + entity resolution; agronomist curation at scale |
| Memory Engine | Grower memory, journal, scan history, streaks, outcome chains | Extension work; depends on W2 identity fix landing in Release |
| Voice Command Center | PARKED (founder, 2026-07-05). Honest kernel defined: Web Speech keyword router → existing screens; TTS exists (`/api/v2/tts`) | On-device STT quality for target accents/languages; no new AI backend |
| Planner | Daily plan runtimes, Today's Action engine, recommendation context | Extension work |
| Marketplace AI | Sell flow, buyer interest tracking (tracking-only, no fake prices) | Real buyer liquidity + live price feeds (partnerships) |
| Funding AI | Funding directory + eligibility engine (advisory; never "approved") | Real lender/NGO program APIs + consent flows |
| Gov / NGO / Insurance / Enterprise portals | NGO dashboards, field-officer views, pilot analytics, org onboarding, invites, tenant isolation primitives | Institutional demand + contracts; RBAC/SSO hardening; insurance = licensed partner only |
| Partner SDK / Public API / Webhooks / GraphQL | REST API + API-health center; enterprise `/api/v1/*` pattern exists in sibling product | API-key mgmt, versioning policy, developer portal, legal terms |
| Plugin Marketplace / Agent Framework | Nothing (deliberately) | Ecosystem demand; sandboxing/security model — LAST, not first |
| Digital Twin | `src/runtime/farmos13` farm-agent foundation | Sensor/actual-yield ground truth to make the twin non-fictional |
| Satellite Intelligence | Honest `no_live_feed` stub (never fabricates NDVI) | Paid imagery feed (e.g. Sentinel/Planet contract) + validation |
| IoT Integration | Nothing | Actual devices with farmers + connectivity reality check |
| Carbon / Climate / Yield / Supply-chain / Disease-prediction / Livestock / Drone / Financial intelligence | Weather advice (live), pest/disease curated knowledge (live), the rest absent or stubbed honest | Each requires a real data feed, a validated model, or a regulated partner. None may ship as heuristic guesses dressed as intelligence. |

## Mission Control
One command center composing EXISTING signals only: farm health score, today's priorities,
weather, scans, alerts, funding matches, marketplace interest, portal summaries, telemetry.
It is a composition surface over the kernel — it owns no data and computes no new "intelligence."
(Production already has Command Center Deck + pilot analytics; Mission Control is their unification,
not a rewrite.)

## Voice Command Center (design ruling)
Voice is an **input modality routed through the same command layer as touch** — not a chatbot and
not an oracle. Utterance → local keyword/intent match → existing app action (navigate, create task,
start scan, read today's plan via existing TTS). Commands that imply generation ("Explain disease",
"Train me") route to EXISTING curated knowledge screens; if confidence is low the assistant asks
one clarifying question. It never speaks a diagnosis, price, or approval that the underlying
engine wouldn't render on screen.

## Enterprise layer
Multi-tenant (tenant-isolation primitives exist) · white-label theming · RBAC (extend existing
roles) · SSO (OIDC) · audit log (extend AuditRuntime) · API keys · developer portal · webhooks ·
GraphQL read layer over the kernel · REST (exists). Sequenced only after a first paying
institutional customer defines the real requirements.

## Isolation contract (how Track B cannot hurt Release)
- Lives only on `feature/farmbrain-os`; never merged while Release criteria are red.
- No edits to shared CI/gates/build:safe from this branch.
- No schema migrations against the production database.
- Anything that eventually merges arrives feature-flagged OFF and passes the full 411-gate chain.
