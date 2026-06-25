# UNIVERSAL_SCANNER_REPORT

One Scan button. FarmBrain decides what was scanned, which providers to use,
how confident it is, and what to recommend — the farmer never pre-selects
Plant/Leaf/Fruit/Flower/Insect.

## Supported scan types (Phase 1)
`leaf · wholePlant · fruit · vegetable · flower · tree · seedling · insect ·
soil · unknown` — `classifyAgriculturalObject(input) → { objectType,
confidence, routingDecision }`. Composes the shipped `detectScanType` (#231) and
adds the three classes it did not cover: **flower, tree, seedling**. An explicit
object-type hint is authoritative (so "Onion leaf" routes to **leaf**, not to
the onion-as-vegetable crop).

## Routing coverage (Phase 2)
| Object | Routes to |
|---|---|
| leaf / wholePlant / seedling | Plant.id → Crop.health |
| fruit | Plant.id → ripeness → damage |
| vegetable | Plant.id → ripeness → quality |
| flower | Plant.id → flower engine |
| tree | Plant.id |
| insect | Insect.id → insect engine |
| soil | soil visual guidance |
| unknown | review (photo coaching) |

**Provider reality:** only Plant.id is keyed today (see SCAN_PROVIDER_ENV_AUDIT).
Crop.health / Insect.id / the ripeness-damage CV steps are **routing targets**,
not live engines yet — the classifier routes to them, and they activate when
their keys/models exist. Nothing is faked in the meantime.

## Acceptance results (Phase 8)
`npm run test:universal-scanner` — **34 assertions PASS** (wired into
`check:universal-scanner`, run on every build). All 9 spec photos route
correctly:

| Photo | → object type |
|---|---|
| Tomato fruit | fruit ✅ |
| Pepper fruit | fruit ✅ |
| Onion leaf | leaf ✅ |
| Rose flower | flower ✅ |
| Maize plant | wholePlant ✅ |
| Mango tree | tree ✅ |
| Aphid | insect ✅ |
| Dry soil | soil ✅ |
| Blurry image | unknown + low-confidence safety line ✅ |

## Safety (Phase 7)
Below 70% confidence the routing decision sets `lowConfidence:true` and surfaces
the exact line **"We're not confident enough."** plus retake / better lighting /
closer / save-for-review. The trust gate + FarmBrain ingestion gate (P0) already
prevent a weak scan from creating a plant, a task, or a FarmBrain update.

## Specialized engines (Phase 6) — the no-fabrication line
Fruit / Flower / Leaf / Insect engines give **honest, crop-aware guidance**.
Farroway has **no trained ripeness/damage/bloom CV model**, so these engines do
**not** emit a fabricated "80% ripe" / "bloom stage 3". Each finding is marked
`assessed:false` (check by hand) unless it composes a REAL signal — the leaf
engine's disease finding uses the FarmBrainV2 disease likelihood; everything
unmeasurable returns honest guidance with `value:null`.

## Auto-update (Phase 5)
A successful, strong scan flows through the P0 ingestion gate into FarmBrain
(crop / health / risk / disease / pest / stage / today's task / timeline / data
quality / confidence). Weak scans are held for review — unchanged from P0.

## Known limitations
- Crop.health, Insect.id, and the ripeness/damage/quality CV engines are
  **routing destinations, not live models** — they light up when keyed/trained.
- Object classification uses photo-context hints + candidate-name inference, not
  a dedicated image classifier; an ambiguous photo stays `unknown` (by design).
- The specialized engines are advisory, not measured CV.

## Pilot readiness
**One-button scan + classification + routing + safety: READY.** Full
multi-provider consensus + measured ripeness/damage: **BLOCKED** on the same two
provider keys + CV models noted in SCAN_ACCEPTANCE_REPORT. The classifier and
result path degrade honestly until then — they never fabricate.
