# DIGITAL_TWIN — v13

A real, immutable node model for the farm hierarchy (8 levels: farm/field/zone/
bed/greenhouse/container/tree/plant). Each node holds last-OBSERVED state:
crop, planting date, last scan time, last health (unknown/ok/watch/at_risk),
observation count.

## What it does (honestly)
- `applyScanToTwin(node, update)` → a new node with updated last-known state.
- `twinStaleness(node, now)` → never_scanned / fresh / aging / stale — **elapsed
  time only, not a forecast.**
- `rollUpHealth(children)` → worst OBSERVED health (unknown if none).

## What it deliberately does NOT do
- It does **not** "predict future state continuously." A forward harvest estimate
  is carried only when the update names a real `estimateBasis` (e.g. crop-calendar);
  an estimate with no basis is dropped. `__digitalTwinHealth().predictionNeverFabricated`
  attests this, and the gate enforces it.

The twin is the honest spine: it remembers what was observed and how long ago —
the foundation a real predictive model could later build on, without pretending
to be one today.
