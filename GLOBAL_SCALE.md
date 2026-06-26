# GLOBAL_SCALE — v14 (honest status)

**Real today:** containerized app on Railway, PostgreSQL (Prisma) as system of
record.

**Declared `requires_infra`:** "100 million farms / 1 billion scans", multi-region,
CDN, **Redis Cluster, Kafka, PostgreSQL HA, read replicas, background workers, event
sourcing**. These are an infrastructure program — provisioning, partitioning, and
load-testing — not TypeScript authored in a sprint. The architecture is *compatible*
with that story (stateless app + managed Postgres + a queue + object storage), and
the registry marks scalability `requires_infra` so no one reads "100M farms" as
shipped.

**Verdict: declared, not fabricated.**
