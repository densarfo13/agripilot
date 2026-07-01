# Domain Model

The bounded contexts, mapped to **real code modules**. These are module boundaries (single
ownership, own tests/gates/health), not deployment boundaries — see PLATFORM_ARCHITECTURE.md.

| Domain | Owns (real path) | Notes |
|---|---|---|
| Farm | `src/runtime/farm/` | farm/crop/location state; emits `farm.*` events |
| FarmBrain | `src/runtime/farmBrain/` | **sole recommendation owner** (`check:single-brain`); canonical state |
| Farm Health | `src/runtime/farmHealth/` | evidence-backed health metrics (no fabricated %) |
| Scan | scan pipeline + `src/runtime/scan/` | identify→disease→treatment→follow-up; emits `scan.*` |
| Marketplace | `src/runtime/buyer/`, sell decision | honest sell verdicts, no fabricated price |
| Funding | funding surfaces | `no_live_feed` until a real program feed |
| Weather | weather runtime | actions, not raw °C |
| Timeline | timeline/journal | `JOURNAL_ENTRY_CREATED`; source of truth after events |
| Notifications | `src/runtime/notifications` | `notification.sent` / `notification.read` |
| Identity | `src/runtime/auth/` | RBAC roles (farmer/gardener/buyer/NGO/gov/admin) |
| Enterprise | `src/runtime/enterprise/` | portals + tenant isolation |
| Analytics | `src/runtime/analytics/` | pilot analytics + observability |

## Ownership rule
Each domain owns its runtime logic + health probe + gates. **Recommendation generation is owned by
FarmBrain alone** — all other domains *publish data*; FarmBrain *consumes* and decides. This is the
"never duplicate recommendation logic" rule, and it is gate-enforced today.

## What is deliberately shared (not per-domain)
Design tokens/components (`src/design/`), the event runtime, and the i18n locale columns are shared
foundations — intentionally single-source, not duplicated per domain (Build Once).
