# PERFORMANCE_BASELINE.md — Farroway

> 2026-07-07 · BLOCKER 4. Only the **bundle** can be measured in this environment (static build output).
> Every runtime dimension — API/upload/scan latency, memory, CPU, cold start, DB latency — requires a
> **running instance under real traffic** and is reported as **NOT MEASURED (requires live instance)**,
> not estimated. The spec says "measure production"; measuring it honestly means saying what a local,
> network-isolated, DB-less environment cannot produce.

## Measured here (real)
| Metric | Value | Source |
|---|---|---|
| Initial JS bundle (raw) | **2,910 KB** | `check:bundle-budget` (build:safe today) |
| Initial JS bundle (gzip) | **893 KB** (budget 1,100 KB — **PASS**) | `check:bundle-budget` |
| Eager chunks on initial path | **11** | `check:bundle-budget` |
| Largest static asset | `src/i18n/columns/T-hi.js` **511 KB raw** (lazy-loaded, gzipped in transit, only the active locale) | file size |

## NOT MEASURED (requires live instance — not fabricated)
| Metric | Why unmeasurable here | How to measure |
|---|---|---|
| API latency (p50/p95) | no running server + no traffic | RUM or `k6`/`autocannon` against Railway; or add a timing field to `/api/ops/health` |
| Upload latency | needs Cloudinary + a real file over the network | measure on device during the acceptance run |
| Scan latency (end-to-end) | needs Plant.id/Kindwise live + a real image | capture `phase` timings in the scan debug envelope (already emitted) |
| DB latency | `DATABASE_URL` unset here; no DB | `/api/ops/health` already returns `database.latencyMs` on Railway — read it there |
| Memory / CPU (under load) | no running process under load | Railway metrics dashboard, or `process.memoryUsage()` sampled under load |
| Cold start | needs a real deploy boot | Railway deploy logs (container start → first 200) |

## Honest baseline statement
The **only** production-representative performance number available without a live instance is the
bundle (893 KB gzip, within budget). Everything else is a live measurement the operator must capture on
Railway. Prior evidence (`RELEASE_PLAN.md`) notes TTFB fast and scan < 5s from earlier live checks, but
those are **not re-measured today** and are not re-asserted here as current.
