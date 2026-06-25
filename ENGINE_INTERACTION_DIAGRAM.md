# ENGINE_INTERACTION_DIAGRAM

```
            ┌──────────────┐
  Camera →  │ 1 Universal  │  classify + route (never asks farmer)
            │   Scanner    │
            └──────┬───────┘
                   ▼
            ┌──────────────┐   retry · cache · circuit breaker · health · degrade
            │ 2 Provider   │ ── Plant.id · Crop.health · Insect.id · Mushroom.id
            │ Orchestrator │    Weather · Soil · (Sentinel: future)
            └──────┬───────┘
                   ▼  (only strong, trusted results — 11 Safety gate)
            ┌──────────────┐
            │  3 FARMBRAIN │  ◄── 8 Digital Twin (histories)
            │ (source of   │  ◄── 7 Outcome Engine (validated learning)
            │   truth)     │
            └──────┬───────┘
                   ▼
            ┌──────────────┐   each rec: action·reason·confidence·urgency·time·benefit·cost·nextReview
            │ 4 Decision   │ ── 5 Evidence Engine (✓ lines) + 6 Trust Engine (H/M/L)
            │   Engine     │
            └──────┬───────┘
                   ▼
       One Daily Decision → Tasks → Timeline → Activity → Outcome prompt
                   │
   cross-cutting:  9 Business (honest-null) · 10 Observability · 12 Offline ·
                   13 Localization · 14 Agronomist Review · 15 Pilot Certification
```
Rule: a provider failure degrades gracefully (confidence down) and never blocks
the chain; a weak scan never reaches FarmBrain or creates a task.
