# FARMBRAIN_OPERATING_MODEL

FarmBrain is the **single source of truth**. It is the only decision engine; every
module reads it; nothing recalculates independently.

## Event → State → Screen
```
event (scan / task_completed / weather / harvest / …)
  → ingestion gate (plant-known + ≥70% + trust + provider-auth + photo-quality)
  → FarmBrainState (the one canonical state)
  → screens read getFarmBrainState() only
```
Weak/unknown/failed events are HELD for review — they never mutate state.

## What FarmBrain owns
crop · health · disease · pests · weather impact · soil · market · funding ·
timeline · recommendations · tasks · confidence. Yield/market/funding/buyers are
`no_live_feed` (honest-null) — present as honest estimates or "connect a feed",
never fabricated specifics.

## Honesty contract
Every metric carries a status + confidence (never a bare number); we never show
"not enough data" — instead waiting_for_first_scan / estimated / low_confidence /
no_live_feed. Recommendations carry evidence (Evidence Engine) + a trust band
(Trust Engine); FarmBrain learns only from validated outcomes (Outcome Engine).
