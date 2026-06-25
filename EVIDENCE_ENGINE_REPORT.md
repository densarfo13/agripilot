# EVIDENCE_ENGINE_REPORT — Phase 1

`EvidenceEngine.buildEvidence()` makes every recommendation explainable in one
place. It returns:
- **Evidence** — ✓ lines, each present ONLY when its signal is real:
  `✓ Plant identified · ✓ Crop stage estimated · ✓ Recent scan · ✓ Weather
  forecast · ✓ Farm history`. Missing evidence is absent, never fabricated.
- **Confidence** — FarmBrain confidence tempered by how much evidence exists.
- **Source Type** — scan / weather / soil / history / crop_profile.
- **Freshness** + **Data Quality** — composed from the DataQualityEngine.

Provider/API names never appear in evidence (gate-enforced). `__evidenceEngineHealth()`.
