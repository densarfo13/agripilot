# ML_DATA_COLLECTION_PLAN — Farroway (Workstream B)

Goal: build a proprietary, honestly-labelled agricultural dataset that powers the ONE
real capability gap — a CV segmentation/counting model (unlocks fruit/leaf counts,
canopy %, disease/pest severity, all currently `awaiting_model` in the evidence-tier
engine).

## Reality check (no fabrication)
- 100,000 scans is a **scale** goal, not a 90-day one. At ~3 scans/farmer/week, 10
  farmers ≈ 120/month. The pilot SEEDS the dataset; 100k requires hundreds–thousands
  of farmers over many months. Plan for the seed now; the scale follows adoption.
- Accuracy targets below are **targets**, not current values. The current accuracy
  baseline is `PENDING` until `golden-dataset/manifest.json` is populated.

## Collection
- Every scan already produces: image (normalized JPEG), provider verdict, confidence,
  farmer context (crop, planting date), and — when offered — a farmer thumbs/feedback.
- **Consent + privacy:** images are farm data; collect under explicit consent, store
  anonymously, never expose one farmer's data to another (the doctrine the platform
  already enforces). No personal data in the training set.

## Annotation workflow
1. Queue: every scan with farmer-confirmed or expert-reviewed outcome enters the
   labelling queue (the review-queue surface exists).
2. Label classes (start narrow): **crop type** → then **disease / pest / weed /
   deficiency** → later flower/fruit segmentation. One taxonomy, versioned.
3. Annotators: field officers / agronomists label; each item gets ≥2 independent
   labels; disagreements escalate to a senior agronomist.

## Quality control
- Inter-annotator agreement tracked; <0.7 on a class → refine the labelling guide.
- Gold set: a held-out, expert-verified set never shown to annotators, used to score
  annotator drift.
- Provenance: every label carries annotator + timestamp + source scan (auditable).

## Model benchmarking
- The `golden:dataset` harness already exists and rejects an accuracy DECREASE vs
  baseline. Populate it first to set a real baseline; every model candidate runs
  against it.
- Benchmark per-class (crop ID, disease, pest) — never a single blended number.

## Accuracy targets (to MEASURE, not assert)
| Class | Pilot target | Stretch |
|---|---|---|
| Crop identification | ≥85% top-1 | ≥92% |
| Disease present/absent | ≥80% | ≥88% |
| Pest present/absent | ≥75% | ≥85% |
Self-learning improves **only after validation** (the existing doctrine) — never
auto-retrain.

**NOW:** turn on consented scan capture + populate the golden set's first 100 verified
images (real baseline). **NEXT:** stand up the 2-annotator labelling queue + QC for
1,000 scans. **LATER:** train + benchmark the first CV model; ship it behind the
evidence-tier engine (which already serves `awaiting_model` fields the day a model lands).
