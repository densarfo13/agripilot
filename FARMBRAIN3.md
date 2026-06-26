# FARMBRAIN3 — v15 (honest status)

FarmBrain 3.0's honest shape:

| Output | Status | How |
|---|---|---|
| Daily farm plan | live | Farm Agent morning plan from real signals |
| Risk prediction | advisory | Weather risk live; agronomic risk = heuristic from real signals (not a fabricated probability) |
| Resource allocation | planned | Needs measured inputs/costs |
| Profit / yield / carbon optimization | requires_model | Optimization needs measured costs/prices/yields + a model — no fabricated optimum |

**Inputs** that are real today: plant scans, weather, historical farm data, farmer
observations. **Inputs that are declared (not wired):** satellite, drone, IoT,
market prices, government advisories — each needs an external feed.

FarmBrain reasons over what it actually has and says so; it does not narrate an
"autonomous optimum" it cannot compute.
