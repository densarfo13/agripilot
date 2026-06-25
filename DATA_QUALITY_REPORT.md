# DATA_QUALITY_REPORT — Phase 2

`DataQualityEngine` scores the data behind every recommendation so trust is
visible, not assumed.

| Dimension | Weight | Basis |
|---|---|---|
| Completeness | 30% | crop, planting date/stage, location, ≥1 scan, ≥1 task |
| Freshness | 25% | recency of last update (1d=100 … >14d=10) |
| Consistency | 20% | signals agree (health-high + disease-high = contradiction → lower) |
| Confidence | 25% | FarmBrain's own confidence |

→ **High / Medium / Low** band. When **Low**, the recommendation carries
"run a fresh scan for reliable guidance" — never a confident call on thin data.
Honest: missing inputs lower the score; nothing is fabricated. `__dataQualityHealth()`.
