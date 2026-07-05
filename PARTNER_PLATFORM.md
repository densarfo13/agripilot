# PARTNER_PLATFORM.md — Public platform & ecosystem (Layer 10, Track B design)

**Sequencing rule:** the public platform exposes the kernel — it cannot precede a stable kernel.
Everything here is demand-gated (Phase 5, `ROADMAP_2026_2035.md`).

## Order of construction
1. **REST v1 (exists)** → add versioning policy (`/api/v1` frozen contracts, deprecation windows),
   published OpenAPI, and error-shape guarantees.
2. **API keys & scopes** — key management per organization; scopes map to graph consent scopes
   (a partner reads ONLY nodes/edges its farmers consented to; tenancy enforced by construction).
3. **Webhooks** — subscriptions over the existing farm event bus (scan.completed, harvest.recorded,
   task.completed…), signed payloads, replayable, per-tenant.
4. **GraphQL read layer** — a typed read view over the knowledge graph (`KNOWLEDGE_GRAPH_SPEC.md`);
   no write mutations in v1.
5. **SDK** — thin typed client over REST/GraphQL; generated, not hand-maintained.
6. **Developer & partner portals** — docs, key self-service, usage dashboards, sandbox tenant.
7. **Plugin marketplace — LAST.** Requires a sandboxing/permission model (plugins get scoped API
   access, never in-process execution), a review pipeline, and demonstrated third-party demand.

## Partner classes (Layer 11 consumers)
Government · NGO · Enterprise agribusiness · Research/universities · Banks · Insurers · Exporters.
Each consumes the SAME platform: same identity, same graph, same consent model, same audit — a
partner integration is a scoped API tenant, not a bespoke build.

## Hard rules
1. **Consent is the product boundary:** no farmer data crosses to any partner without explicit,
   per-purpose, revocable consent recorded in the graph. Aggregates require k-anonymity review.
2. Regulated data flows (credit assessment, insurance underwriting) additionally require the
   licensed-partner framework of Layer 9 — the API alone is not authorization.
3. Public API answers inherit honesty: confidence + provenance fields are part of the contract;
   `no_live_feed` propagates to partners rather than being papered over.
4. No partner-specific forks. Feature flags + scopes, one codebase.
