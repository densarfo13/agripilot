# V13_ARCHITECTURE — Farroway v13

v13 extends the platform (no redesign, no removals, backward compatible). The spec
asks for ~20 capability areas; most cannot be built as real capability today
without fabricating the numbers its own AI-SAFETY section forbids. So v13 ships:

1. **The genuinely buildable core (live):**
   - **Digital Twin** (`src/runtime/v13/DigitalTwin.ts`) — Farm › Field › Zone › Bed
     › Greenhouse › Container › Tree › Plant node model. Scans update last-known
     state + honest staleness. A forward estimate is carried ONLY with a named
     basis (e.g. crop-calendar) — never fabricated.
   - **Farm Agent** (`FarmAgent.ts`) — a morning planner that turns REAL signals
     (crop calendar, live-weather risk, scan staleness, last-action) into a
     prioritized water/fertilize/prune/harvest/spray/inspect/wait list, every
     action evidence-cited. No real signal → honest hold/inspect, never invented
     urgency.

2. **An honest Capability Registry** (`V13CapabilityRegistry.ts`) — every v13 ask
   mapped to its TRUE status: live / advisory / planned / no_live_feed /
   requires_cv / requires_validation / requires_infra, each with a basis or a
   named requirement. The gate forbids marking anything predictive/market/
   satellite/carbon "live".

**Backward compatibility:** purely additive runtime under a new `src/runtime/v13/`
path; nothing existing is changed or removed. build:safe stays green.
