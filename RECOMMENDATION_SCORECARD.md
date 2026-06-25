# RECOMMENDATION_SCORECARD

Every recommendation now carries, end to end:

| Field | Source |
|---|---|
| Action / next step | Decision Engine |
| Why (reason) | Decision Engine |
| Evidence (✓ lines) | **Evidence Engine (new)** |
| Confidence | FarmBrainState + Evidence |
| Data Quality (High/Med/Low) | **Data Quality Engine** |
| Trust (High/Med/Low) | **Trust Score Engine (new)** |
| Urgency / time / benefit | Decision Engine |

Quality gates (Phase 6, enforced): rejected if no crop / unknown scan / low
confidence / missing evidence / contradictory evidence / provider-unavailable
without fallback. A weak scan never updates FarmBrain or creates a task.
