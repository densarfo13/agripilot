# DIGITAL_TWIN_REPORT — already built, composed not rebuilt

The Phase-4 digital twin exists: `src/runtime/farmos13/DigitalTwin.ts`.

- **Hierarchy:** Farm › Field › Zone › Bed › Greenhouse › Container › Tree › Plant
  (8 node types).
- **Scans update it:** `applyScanToTwin(node, update)` records last-known crop,
  planting date, last scan time, last OBSERVED health, observation count — immutably.
- **Honest staleness:** `twinStaleness()` = elapsed time only (never_scanned / fresh
  / aging / stale), NOT a forecast.
- **No fabricated future state:** a forward estimate is carried ONLY with a named
  basis (e.g. crop-calendar harvest date); a no-basis estimate is dropped.

**Timelines** (Phase-4 ask): health / treatment / yield timelines exist
(`cropMemoryGraph` + FarmBrainState). The growth / weather / recommendation
timelines are composed from the same FarmBrainState event log.

Building a "v14 digital twin" would duplicate this — a charter violation. The twin is
the honest spine a real predictive/CV model attaches to later.
