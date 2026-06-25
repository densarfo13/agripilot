# FARMBRAIN_VALIDATION

Certified deterministically (real ingestion gate + classifier, 11 assertions, in CI):

| Rule | Result |
|---|---|
| Strong scan (known + ≥70% + trust + auth + photo-ok) → **ingests** | ✅ |
| Weak scan (low confidence) → **HELD** (`confidence_below_70`) | ✅ |
| Unknown plant → **HELD** (`plant_unknown`) | ✅ |
| Provider failure → **does not ingest**, pipeline continues (no crash) | ✅ |
| Non-plant (shoe/person/table/wall/vehicle) → **not a supported plant**, no diagnosis | ✅ |
| Confidence **degrades** as evidence decreases | ✅ |

Recommendations compose plant identity + growth stage + scan evidence + weather +
soil + location + history (FarmBrainState). FarmBrain **never invents** a diagnosis:
weak/unknown/failed inputs are held for review, not ingested. The environment layer
never blocks FarmBrain — if Soil/weather drop, confidence falls, functionality does not.
