# Platform Architecture

Truthful map of what Farroway **actually is** today, plus one explicit architectural decision.
Nothing here describes aspirational structure — every claim maps to code in this repo.

## What it is
A **modular monolith**, domain-structured:
- **Client** — Vite + React PWA (offline-first; service worker; `src/`).
- **Server** — Node/Express + Prisma/PostgreSQL (`server/`), plus a NestJS intelligence service
  (`server/intelligence/`).
- **Domains** — bounded **code modules** under `src/runtime/<domain>/` (farm, farmBrain, farmHealth,
  scan, marketplace/buyer, funding, weather, timeline, notifications, auth/identity, enterprise,
  analytics, …). Each owns its runtime logic, health probe, and gates.
- **Single brain** — only FarmBrain generates farmer recommendations (`check:single-brain`,
  `check:farmbrain-x`). No domain duplicates recommendation logic.
- **Event layer** — `src/runtime/events/eventRuntime.js` emits domain events; FarmBrainState
  ingests them into one canonical state (see EVENT_CATALOG.md).
- **Enforcement** — 400+ `build:safe` gates (17 honesty gates, design-system gates, i18n, security,
  persistence). See PRODUCTION_GATES.md.

## Architectural DECISION — remain a modular monolith for the pilot
**Decision:** Farroway will **not** be split into independently-deployable bounded services with a
network event bus before the pilot. The domains are **module boundaries, not deployment boundaries.**

**Why (honest engineering, not dogma):**
- The app is **pilot-ready** and gate-locked. A microservice/event-bus rewrite is a large,
  destabilizing change with **operational cost** (deploy topology, distributed tracing, eventual
  consistency, network failure modes) and **zero KPI benefit** for the first 100 farmers.
- The properties the split is meant to deliver — **observability, testability, single ownership,
  no duplicate recommendation logic** — are **already achieved in-process**: per-domain health
  runtimes, per-domain gates, the single-brain gate, and the event-ingestion state layer.
- The real blocker to launch is **operational** (one real scan + real pilot data), not
  architectural. Rewriting the architecture would delay the pilot without moving any north-star metric.

**Revisit when:** sustained scale (post-1,000 farmers) creates a genuine independent-scaling or
independent-deploy need for a specific domain (likely Scan or Analytics first). At that point,
extract that ONE domain behind its existing event contract — the module boundaries already make
this a clean seam.

## The seams are already clean
Because domains communicate through the event layer + the FarmBrain state contract, any future
extraction is a bounded refactor, not a rewrite. The modular monolith **preserves the option** to
split later without paying the cost now.
