# FarmBrain OS — Track B Architecture V1

**Status: ARCHITECTURE ONLY — Track B governance (RC two-track ratified 2026-07-05)
forbids implementation until Track A's 12 exit criteria are green AND founder
sign-off. Track A currently: 0/12, keystone evidence (one real production scan)
still absent. This document is the buildable blueprint for the day that gate
opens.**

Authored 2026-07-16 against master @ b15abab5 (boot 2026-07-16T14:25:31Z).

---

## Governing constraints (inherited, non-negotiable)

1. Do not modify the existing scan pipeline — every module here consumes its
   outputs through the existing event/state layer (FarmBrainState V1 is the
   single event→state→screen layer; EXTEND, never fork).
2. Never fabricate: yield, market, buyers, funding are `no_live_feed`.
   Confidence numbers come only from real model probabilities or fitted
   calibration — never additive "context boosts".
3. All farmer-facing strings registered in the 6 i18n columns; farmer-gate +
   distinctness ratchets apply.
4. Feature-flag everything OFF by default (utils/featureFlags.js DEFAULTS +
   `VITE_FEATURE_*`); kill switch = unset the var.
5. Server-owned decisions; clients render state, never derive it.

---

## Module status matrix

| # | Module | Status today | Track B delta |
|---|--------|--------------|---------------|
| 1 | Farmer feedback learning loop | **SHIPPED** (master, 2026-07-16) | Calibration fitting once ≥ threshold real pairs |
| 2 | Scan confirmation workflow | **SHIPPED** (master, 2026-07-16) | none — operate it |
| 3 | Farm digital twin | **SHIPPED** (farmos13 + FarmBrainState V1) | Twin read-API consolidation |
| 4 | Knowledge graph schema | Partial (curated src/knowledge layer) | Graph projection over existing facts |
| 5 | Regional intelligence engine | Partial (regional packs + runtime) | Pack coverage expansion + provenance |
| 6 | Treatment outcome tracking | **SHIPPED** (outcome fields) | Follow-up prompt loop |
| 7 | Agronomist AI recommendation layer | Partial (rec engine + daily actions; voice = Jarvis, parked) | Evidence-weighted recs after calibration |

Modules 1, 2, 6 shipped on master because they are Track A-compatible
(scan telemetry/feedback). They are listed here so Track B never rebuilds them.

---

## Module 1 — Farmer feedback learning loop

**Exists:** `ScanTrainingEvent` rows carry prediction (`plantName`,
`predictedIssue`, `confidence` band), farmer response (`userFeedback`:
helpful / not_sure / not_helpful / **farmer_confirmed_species** /
**farmer_rejected_species**), and eventual `outcome`
(recovered / spread / lost / unknown). Aggregated by `computeScanEvidence`
(confirmationRate, falseIdentificationRate, topUnknownPlants) on
/admin/pilot-analytics.

**Track B delta — calibration fitting (BLOCKED on data volume):**
- Trigger: ≥ 200 decided species events AND ≥ 50 distinct scans (tune later).
- Job: offline batch (script, not runtime) fits an isotonic/Platt calibration
  from providerConfidence → empirical P(confirmed). Output versioned file
  `server/src/ml/calibration/calibration-v<N>.json` with training-window
  metadata. Runtime loads it behind `FEATURE_SCAN_CALIBRATION` and only
  RESCALES displayed confidence (never reorders candidates, never crosses the
  CONFIRMED threshold upward).
- Test plan: golden-file fit on synthetic pairs; monotonicity property test;
  gate `check:calibration-provenance` (file must carry sample counts; refuse
  n < threshold).

**Migrations: none.**

## Module 2 — Scan confirmation workflow

**Exists end-to-end:** PROVISIONAL and LOW_IDENTIFICATION_CONFIDENCE carry
`requiresConfirmation` + ≤3 real ranked candidates; card renders top candidate
+ alternates + Confirm + "None of these"; `POST /api/scan/:scanId/confirm-plant`
(idempotent, ownership-scoped, `{reject:true}` supported) → gated health reveal
→ treatment (recommendationLevel). Guided multi-view flow at /scan/guided
(session API, 5 view types, evidence aggregation).

**Track B delta: none.** Operate and measure.

## Module 3 — Farm digital twin

**Exists:** FarmProfile, V2CropCycle, V2HarvestRecord, scans, tasks, timeline,
CropStage — composed by FarmBrainState V1 and the farmos13 runtime.

**Track B delta — twin read-API consolidation:**
- `GET /api/farm/:farmId/twin` → one envelope `{ profile, activeCycles[],
  recentScans[], openTasks[], harvests[], stage, dataQuality }` assembled from
  EXISTING tables (no new writes, no new columns). Org-scoped via
  `farmer.organizationId` (never a flat spread — see ngoDashboard lesson;
  cover with org-A-vs-B route tests).
- Flag: `FEATURE_FARM_TWIN_API` (server env, default off).
- Components: none new — Home/My Farm already render these slices; the
  endpoint exists for NGO/enterprise consumers.

**Migrations: none.**

## Module 4 — Agricultural knowledge graph

**Exists:** curated, gate-enforced knowledge layer (`src/knowledge`): crop
profiles, disease/pest entries, organic treatments, regional packs. Facts are
files with review provenance — that is a feature, not a gap.

**Track B delta — graph PROJECTION, not a new store:**
- Do NOT create `agri_knowledge_nodes` as a hand-maintained truth store — it
  forks the knowledge layer. Instead: a build-time script projects the existing
  knowledge files into a read-only adjacency index
  `src/knowledge/graph/knowledgeGraph.json`
  (`nodes: {id, type: crop|disease|pest|treatment|region|season, name}`,
  `edges: {from, to, rel: susceptible_to|treated_by|common_in|active_in,
  source}`). Every edge carries the source file — provenance by construction.
- Query API: pure function `queryGraph({ crop, region, season, stage })` →
  `{ risks[], treatments[], seasonalNotes[] }` used by the recommendation
  engine as an explanatory "why" layer.
- Expected-yield edges: **excluded** (`no_live_feed`).
- Gate: `check:knowledge-graph-sync` — projection must be regenerable from
  sources with zero diff.
- Tests: projection determinism; every edge resolves to a source; cycle safety.

**Migrations: none (file artifact, not a table).**

## Module 5 — Regional intelligence engine

**Exists:** 4 regional packs + RegionalKnowledgeRuntime + regional composite
(common crops, diseases, planting windows per region).

**Track B delta — coverage + provenance, not a new engine:**
- Expand packs (Ghana regions first: Ashanti/Kumasi, Greater Accra, Northern),
  each entry carrying `source` + `reviewedBy`.
- `regional_crop_profiles` table: **rejected** — packs are versioned,
  reviewable files; a table invites unsourced writes.
- Resolution: GPS → country/region already available from farm profile; the
  runtime keys packs by region. No new inputs needed.
- Tests: pack schema validation gate (exists — extend for provenance fields).

**Migrations: none.**

## Module 6 — Treatment outcome tracking

**Exists:** `ScanTrainingEvent.outcome` (recovered/spread/lost/unknown) +
`outcomeNote`; OutcomeRuntime/OutcomeChainRuntime aggregate.

**Track B delta — the follow-up prompt loop:**
- N days (default 7, env `SCAN_FOLLOWUP_DAYS`) after a treatment-grade
  recommendation, surface an in-app prompt on Home: "Did the treatment help?"
  → writes `outcome` on the ORIGINAL event (no new table).
- Reuses insightNotificationAdapter path once a live channel exists (note:
  notifications/dedupStore is dormant and needs its metadata column fixed
  BEFORE wiring — see dedupStore deferral).
- Flag: `FEATURE_TREATMENT_FOLLOWUP` (default off).
- i18n: ~3 farmer strings × 6 columns.
- Tests: prompt eligibility resolver (pure), idempotent outcome write,
  no-prompt-before-N-days.

**Migrations: none.**

## Module 7 — Agronomist AI recommendation layer

**Exists:** recommendation engine + Today's Farm Plan (daily actions);
post-scan treatment surfacing (organic-only, confident-match-only, chemicals
deferred to officer); scan evidence "why" paths (satellite deliberately
excluded post-scan, gate-locked); voice assistant surfaces; Jarvis MVP parked
on `feature/farroway-jarvis-mvp` (flag-off, never on /scan, merge gate =
device verify + founder sign-off).

**Track B delta — evidence-weighted recommendations (LAST in sequence):**
- Consumes Modules 1 (calibrated confidence), 4 (graph "why"), 5 (regional
  priors as EXPLANATION, never as confidence arithmetic), 6 (outcome data).
- Output contract (extends existing recommendation envelope):
  `{ action, timeframe: today|this_week|before_harvest, why: [graphEdgeRefs],
  evidence: {confidence, outcomesSeen} }`.
- Hard rule: regional/seasonal context ranks ACTIONS, never inflates
  identification confidence.
- Flag: `FEATURE_AGRONOMIST_LAYER` (default off, pilot allowlist first).

---

## Cross-cutting

**API contracts added by Track B (all flag-gated, additive):**
- `GET /api/farm/:farmId/twin` (M3)
- `POST /api/scan/:scanId/outcome` (M6 — body `{outcome, note?}`, ownership-scoped, idempotent)
- (M1/M4/M5/M7 add no endpoints — they enrich existing envelopes.)

**Database migrations: ZERO.** Every module rides existing tables or versioned
file artifacts. This is deliberate: the schema survived 412 gates; Track B must
not destabilize it.

**Feature flags:** `FEATURE_SCAN_CALIBRATION`, `FEATURE_FARM_TWIN_API`,
`FEATURE_TREATMENT_FOLLOWUP`, `FEATURE_AGRONOMIST_LAYER` — all default OFF,
registered in the DEFAULTS registry, env-activated, individually killable.

**Backward compatibility:** no existing envelope field changes meaning; new
fields are additive; flags off = byte-identical behavior to today.

**Test matrix (per the spec's asks):**
| Area | Vehicle |
|---|---|
| Correct plant identification | existing scanConfidenceRealScore + confirmation suites |
| Wrong plant rejection | findConfirmableCandidate rejects non-stored taxa (exists) + reject-flow test (exists) |
| Disease recommendation | recommendationLevel gating suite (exists) + M7 envelope tests (new) |
| Regional ranking | M5 pack schema gate + M7 action-ranking tests (new) |
| Offline mode | existing OfflineValidationRuntime + SW suites |
| Multilingual | i18n farmer-gate + distinctness ratchets (6 locales, enforced in build:safe) |

**Build sequence when the gate opens:**
M6 follow-up loop → M4 graph projection → M5 pack expansion → M3 twin API →
M1 calibration (data-gated) → M7 agronomist layer. Each its own PR + gates.

## Activation gate (verbatim condition)

Track B implementation begins when ALL hold:
1. Track A exit criteria green (RELEASE_PLAN.md — currently 0/12).
2. ≥ 1 real production scan proven in Railway logs (`[scan.session] created`
   or `[scan.confirm] confirmation_completed`). **Still zero as of this doc.**
3. Founder sign-off recorded in this file's revision history.
4. For M1 specifically: the data-volume trigger (≥200 decided events).
