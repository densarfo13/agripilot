# ENTERPRISE_SCALE — v13 (honest status)

The spec asks for millions of farms, horizontal scaling, event-driven workers,
Redis, PostgreSQL, object storage, CDN, audit logs, feature flags, zero-downtime
deploys.

**What's real today:** PostgreSQL (Prisma) is the system of record; audit logging
and feature flags exist in the codebase; the app deploys on Railway. These are
genuine.

**What's honestly out of scope for app code (`requires_infra`):** horizontal
scaling to millions of farms, an event-driven worker fleet, Redis queues, object
storage, and a CDN are **operations and infrastructure**, not TypeScript I author
in a sprint. Claiming "supports millions of farms" from a code change would be a
fabrication. The path is real (containerized app + managed Postgres + a queue +
object storage + CDN), and it's named here — not faked as done.

**Verdict: declared, not fabricated.** The architecture is compatible with that
scaling story; achieving it is an infra program, and the registry marks it
`requires_infra` so no one reads it as shipped.
