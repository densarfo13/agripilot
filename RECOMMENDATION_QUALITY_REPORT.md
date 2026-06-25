# RECOMMENDATION_QUALITY_REPORT — Phase 3

`DecisionQualityEngine` scores every recommendation against 9 criteria and
**rejects** weak ones before they reach the farmer:

supportedByEvidence · noContradiction · cropSpecific · stageSpecific ·
weatherAware · confidenceAssigned · reasonAssigned · benefitAssigned ·
timeAssigned · (notGeneric).

Hard criteria (any failure = rejected): evidence, no-contradiction, confidence,
reason, benefit, time, not-generic. `rejectWeakRecommendations()` filters a list
to only the passing ones. Verified: a complete evidenced rec passes; "Check your
crop" (generic), a no-confidence rec, and a contradictory rec are all rejected.
`__decisionQualityHealth()`.
