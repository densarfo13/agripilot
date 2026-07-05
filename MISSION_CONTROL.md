# MISSION_CONTROL.md — the single command center (Layer 6, Track B design)

**Mission Control is a composition surface, not a system.** It owns no data, computes no new
intelligence, and introduces no new stores. It renders EXISTING signals through one role-scoped
dashboard. (Production already has the pieces: Command Center Deck, pilot analytics, founder OS
page, health composites — Mission Control unifies them; it does not rewrite them.)

## Widget sources (all existing)
| Widget | Source |
|---|---|
| Farm health | FarmHealthEngine score + band |
| Today's priorities | daily-plan / Today's Action engine |
| Weather | live weather advice |
| Scans | scan history + trust states |
| Alerts | notification runtime |
| Tasks / Journal | task chains, journal store |
| Funding | eligibility engine (advisory) |
| Marketplace | sell listings + buyer interest (tracking-only) |
| NGO / Government / Enterprise metrics | pilot analytics + portal runtimes |
| System health | releaseLock / goLive composites + API health center |

## Role scoping (same identity, one dashboard, filtered views)
- **Farmer:** their farm only — health, today, weather, scans, tasks, sell, funding matches.
- **Field officer / NGO:** program cohort views (consented data only).
- **Government / Enterprise:** aggregate program metrics; never row-level farmer data without
  explicit consent scope.
- **Operator/founder:** system health, telemetry, release scoreboard.

## Rules
1. A widget renders only what its backing engine already asserts — no widget-level computation
   that could diverge from the source of truth.
2. Absent feeds render honest empty states (`no_live_feed`), never mock numbers.
3. Every widget deep-links to the owning surface; Mission Control is navigation + glanceability.
4. Mobile-first and low-literacy-first, same as every farmer surface; enterprise density is a
   role-scoped variant, not the default.
