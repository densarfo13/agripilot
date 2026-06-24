# FARM_HEALTH_ENGINE_REPORT.md

**Sprint #216 §4 — already shipped (#194/#197).** Date: 2026-06-19.

`FarmHealthEngine.ts` ships since #194 with the 4-tier band (#197):
0-100 score → **Excellent ≥85 / Good 65-84 / Watch 40-64 / Critical <40**.
(The spec's "At Risk" = the existing "Critical" band; relabeling would
break `check:digital-agronomist` and carries no KPI justification, so
the shipped label stays.)

Inputs compose real probes only (crop/vegetation health, scan history,
task completion, weather risk, disease signals); the score never
fabricates — "Unknown"/Critical when a signal is absent, never a
synthetic number. "Never show score without explanation" is enforced
by the Why line (#194) + `check:digital-agronomist`.

This sprint anchors health to the **FarmLifecycleEngine** state (§1):
no farm state → no health recommendation, only setup guidance.
