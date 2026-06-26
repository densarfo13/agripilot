# SCAN_ENGINE_REPORT — spec → reality (no new engines)

This "v14 World-Class" spec is ~95% already implemented. Per the engineering charter
(one source of truth · reject duplicate logic · never fabricate), the honest
deliverable is a traceability audit, NOT a parallel rebuild. Each phase below maps to
the EXISTING implementation with file evidence.

| Phase | Spec ask | Status | Implementation (file evidence) |
|---|---|---|---|
| 1 Universal plant ID | any category + scientific/family/genus/edibility/toxicity/companions/pollinators | live | `src/runtime/scan/AgriculturalObjectClassifier.ts` (18 classes) routes; `src/runtime/scan/v12/PlantReference.ts` returns all 10 metadata fields for known crops, `unknown` otherwise |
| 2 Multi-model ensemble (ScanFusionEngine) | providers vote → consensus / agreement / disagreement | live | `src/runtime/scan/consensus/ScanProviderConsensus.ts` (`buildScanConsensus`) — a new ScanFusionEngine would DUPLICATE this |
| 3 Visual analytics | fruit/leaf count, canopy %, ripeness, severity via segmentation | awaiting_model | `EvidenceTierEngine` marks every CV field `awaiting_model` — no segmentation model is deployed; producing values = fabrication |
| 4 Farm digital twin + timelines | plant/field/farm + growth/health/weather/treatment/yield | live | `src/runtime/farmos13/DigitalTwin.ts` + health/treatment/yield timelines |
| 5 Predictive engine | harvest date, yield range, outbreak, flowering, storage | partial | harvest date = real (crop calendar); yield-range/outbreak = `requires_model` / `requires_validation` in the v13/v14 registries |
| 6 Quality assurance | blur/lighting/distance/focus → "Retake" | live | `src/runtime/scan/quality/ImageQualityGate.ts` |
| 7 Field intelligence | merge weather/soil/satellite/yield/actions/calendar/alerts/market | partial | weather/soil/calendar live; satellite/market/gov-alerts = `no_live_feed` / `planned` |
| 8 Self-improvement | collect outcomes, retraining dataset, never auto-retrain | doctrine live | outcome recording exists; learning off until 50+ samples; auto-retrain forbidden |
| 9 Explainable AI | why/evidence/confidence/alternatives/benefit/risk | live | v12 envelope + `AgentRegistry` + `FarmerCopilot` all carry reason + evidence + confidence + alternative |
| 10 Enterprise | 10M farms, Kafka, K8s, Redis, SOC2 | requires_infra | declared in the v14 registry — ops/infra program, not a sprint |

**Verdict:** no new engine is buildable without duplicating canon or fabricating
measurements. The platform already IS this engine, honestly. The real gaps are
external (a CV/segmentation model, provider feeds, infra) — see WORLD_CLASS_GAP_REPORT.
