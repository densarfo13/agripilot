# EVIDENCE_ENGINE_REPORT — evidence-tier resolution + farmer surfacing

Extends the existing evidence-tier engine (shipped previously, `EvidenceTierEngine`
— the single source of truth for tier logic). This sprint adds the farmer-facing
resolution + the ingestion policy, WITHOUT duplicating the tier logic (charter: one
source of truth, no duplicate logic).

## What was already in place (composed, not rebuilt)
- `EvidenceTierEngine` — 6 tiers, field classification, `evaluateField`, the honest
  record, real estimates from crop calendar / live weather / soil.
- `FarmBrainScanIngestion` — the confidence-gated whole-scan ingestion decision.
- `imageQualityPreflight` — luminance + sharpness scoring before a scan is sent.

## New this sprint
- **EvidenceFieldResolver** — maps each field's engine record to the spec's 8-value
  status enum + the full contract `{ status, value, confidence, evidenceTier,
  source, reason, estimated, lastUpdated }`. Adds:
  - `farmerLabel(status)` — plain words a low-literacy farmer reads (Measured /
    Estimated / Likely / Live data / Needs lab test / Live data unavailable / Not
    available yet / Unknown). **Never** the enum, provider, or API.
  - `canFarmBrainIngest(status, confidence, value)` — the §7 ingestion policy:
    ingest DIRECT_MEASURED / MODEL_ESTIMATED / FUSED_ESTIMATE / LIVE_PROVIDER only
    when confidence ≥ 70 and a value exists; NEVER LAB_REQUIRED / UNKNOWN /
    UNAVAILABLE / NO_LIVE_FEED.

## Status mapping
measured→DIRECT_MEASURED · estimated→MODEL_ESTIMATED/FUSED_ESTIMATE · live→
LIVE_PROVIDER · awaiting_lab→LAB_REQUIRED · awaiting_provider→NO_LIVE_FEED ·
awaiting_model/awaiting_input→UNAVAILABLE · unknown→UNKNOWN.

## Enforced (gate + 511-assertion test)
Every field returns the full contract with a confidence + reason; no bare
"unavailable" string; lab fields are never photo-valued; farmer labels carry no
jargon; the farmer scan components are scanned for leaked enum/provider/API tokens.
