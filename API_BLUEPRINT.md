# API Blueprint

Honest split: what the API **is today** vs. a **forward plan**. Nothing here is claimed as built
unless it exists in `server/`.

## Today (exists)
- **Express API** (`server/`) — auth, farm/crop, `/api/scan/analyze` (provider calls server-side —
  keys are secrets, never in the browser), `/api/scan/diagnostics`, `/api/invites`, `/api/health`
  (emits a persistence + readiness envelope), admin/pilot endpoints (`/api/admin/scan/last-trace`,
  `/api/admin/location/debug`).
- **NestJS intelligence service** (`server/intelligence/`) — pest-risk / ingest / admin routes with
  validation schemas + roles guard.
- **Enterprise API** — returns PUBLIC-only data + `503` until `ENTERPRISE_API_KEYS` is set (honest;
  never leaks tenant data).

## Forward plan (NOT built — do not represent as done)
- **Versioned REST** (`/api/v1/…`) — a partial `/api/v1/*` enterprise surface exists; full
  versioning is future.
- **OpenAPI** — generate a spec from the route + validation schemas.
- **Webhooks** — a delivery framework over the existing domain events (EVENT_CATALOG.md).
- **SDK-ready contracts** — publish typed contracts from the event catalog + FarmBrain state.

## Principle
The event catalog + FarmBrain state contract are the natural public surface. When external API
demand is real (post-pilot / enterprise customer), expose them **behind versioning + OpenAPI** —
built on the existing seams, not a rewrite. Building this now would be speculative infrastructure
with no consumer; deferred deliberately.
