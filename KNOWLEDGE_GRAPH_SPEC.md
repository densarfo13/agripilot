# KNOWLEDGE_GRAPH_SPEC.md — Unified Knowledge Graph (Layer 2, Track B design)

**Rule zero: no duplicate databases.** Graph v1 is an **entity-link index over the existing Prisma
stores**, not a new datastore. A dedicated graph engine is considered only if v1 measurably fails
real query patterns.

## Node types (canonical ID = existing store ID wherever one exists)
Farmer (`user.id` — post W2 identity fix), Organization, Farm, Garden, Crop, Plant, Livestock*,
Disease, Pest, WeatherEvent, SatelliteObservation*, SoilProfile, MarketListing, Buyer, FundingProgram,
InsuranceProduct*, GovernmentProgram, NGOProgram, Task, Harvest, JournalEntry, Recommendation, Scan.
(* = no production data today; node type reserved, instantiated only when a real source exists.)

## Edge examples
`Farmer OWNS Farm` · `Farm GROWS Crop` · `Scan OBSERVED Plant` · `Scan SUGGESTS Disease` ·
`Disease TREATED_BY Treatment` · `Task ADDRESSES Recommendation` · `Harvest FROM Crop` ·
`Buyer INTERESTED_IN MarketListing` · `Farmer ELIGIBLE_FOR FundingProgram (advisory)` ·
`WeatherEvent AFFECTS Farm` · `JournalEntry RECORDS Task|Harvest|Scan`.

## Provenance — mandatory on every edge
```
edge = { from, to, type, confidence?, provenance: {
  source: scan_event | curated_knowledge | farmer_input | operator_input | external_feed,
  ref: <store id / knowledge key / feed id>, at: <timestamp> } }
```
No provenance → no edge. `external_feed` edges are legal only for feeds that are actually live —
the `no_live_feed` contract applies to graph content exactly as it does to screens.

## Consent & tenancy
- Every node carries `tenantId`; cross-tenant traversal is impossible by construction.
- Farmer-derived nodes carry a consent scope; edges to institutional consumers (funding, insurance,
  buyers, government/NGO analytics) are traversable only where the farmer granted that scope.
  Consent is per-purpose and revocable; revocation prunes traversal, not history.

## v1 scope (post-Release only)
1. Read-side entity-link layer: resolvers that join existing stores into graph-shaped answers.
2. Query patterns to serve first: "everything about this farm", "history of this crop on this
   farm", "what preceded this outcome", "which farmers match this program (advisory, consented)".
3. Write path unchanged — modules keep writing to their stores; the graph indexes them.

## Non-goals for v1
No graph database, no embeddings store, no inferred (model-generated) edges — inferred edges would
be fabricated relationships until a validated model earns them.
