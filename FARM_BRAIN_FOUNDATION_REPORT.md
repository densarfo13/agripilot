# FARM_BRAIN_FOUNDATION_REPORT.md

**Sprint #208 — Mythos Farm Brain Foundation.**
Date: 2026-06-19

This spec is well-scoped: §7 now asks for the satellite **interfaces
only**, returning `UNCONFIGURED`, "no fake NDVI". That is compatible
with the frozen doctrine — it's the honest stub that *enforces*
"never fake satellite" at the type level. CropStageEngine is real,
computable agronomy. So most of this is genuinely buildable. The
sections that already shipped were declined; everything else was
built honestly.

---

## Per-section verdict

| § | Section | Verdict |
|---|---|---|
| 1 | Farm Brain Core | **BUILT.** `FarmBrainContracts.ts` + `FarmBrainRuntime.ts` (`getFarmBrain(farmId)`) over #207's `FarmBrain.ts`. Read-only; `satelliteHistory` always `[]` |
| 2 | Crop Stage Engine | **BUILT.** `CropStageEngine.ts` — 10 crops, DAP from planting date, stage + confidence (null when no date — never faked) |
| 3 | Farm Health Engine | ✅ **SHIPPED** (#194/#197) — score + level + contributors + "never show score without explanation" |
| 4 | Adaptive Task Generator | **BUILT.** `AdaptiveTaskGenerator.ts` — ONE task, action + reason + confidence + time + followUp; null (not generic) when no signal |
| 5 | Scan Memory | **BUILT.** `FarmScanMemory.ts` — last scans / issues / outcomes / follow-ups + honest repeat-confidence hint (null when no history) |
| 6 | Outcome Learning | ✅ **SHIPPED** (#36/#198) — Better/Same/Worse → outcome_recorded; "do not fabricate" already honored |
| 7 | **Satellite Foundation** | **BUILT (honest stub).** `SatelliteContracts/Provider/CorrelationEngine.ts` — always `UNCONFIGURED`, all index fields `null`, gate forbids any numeric NDVI. No Sentinel client, no credential read |
| 8 | Empty-State Elimination | ✅ **SHIPPED** (#207) — Home hero → FarmBrain next step (add crop → scan → outcome) |
| 9 | Daily Farm Brief | ✅ **SHIPPED** (#192-#194) — CommandCenterDeck renders Health/Stage/Risk/Action/Reason/Confidence above the fold |
| 10 | Health Checks | **BUILT.** `__farmBrainHealth()` now returns the 7 readiness flags |
| 11 | Build Gates | **BUILT.** `check:farm-brain` extended (see below) |
| 12 | Report | this file |

**Tally: 6 sections built · 4 already shipped · 0 fabrication.**

---

## Architecture (text)

```
profile + existing histories (weather/scan/task/outcome/risk)
        │
   getFarmBrain(farmId)  ── satelliteHistory:[] (frozen)
        │   ├─ inferCropStage(crop, plantingDate, asOf) → stage + DAP + confidence|null
        │   ├─ generatePrimaryTask(stage, weather, scanIssue) → ONE task (reason+confidence)
        │   ├─ buildFarmScanMemory(scanHistory) → repeat-confidence hint|null
        │   └─ correlateSatellite() → UNCONFIGURED (ndvi:null, confidence:null)
        ▼
   __farmBrainHealth() → { farmBrainReady, cropStageReady, farmHealthReady,
                           adaptiveTasksReady, scanMemoryReady,
                           outcomeLearningReady, satelliteFoundationReady,
                           satelliteUsed:false, readOnly:true, neverFabricates:true }
```

## Data model
`FarmBrainRecord` = farmId, crop, variety, location, plantingDate,
cropStage, farmSize, + weather/scan/task/outcome/risk histories +
`satelliteHistory: []`. **No new table** — composed read-only from
signals the app already holds.

## Health scoring model
Unchanged — `FarmHealthEngine` (#194/#197): 0-100 + 4-tier band +
contributors, "never show score without explanation". Satellite
stress is an input ONLY when configured; today it's UNCONFIGURED →
omitted, never zero-filled.

## Task generation model
Priority: scan issue (most specific) → crop stage → weather. Each
task is stage-appropriate agronomy with a reason + bounded confidence
(mirrors signal strength, never inflated) + time + follow-up. No
generic tasks; returns null → onboarding guidance instead.

## Outcome model
Unchanged — Better/Same/Worse captured (#198) → knowledge edge (#36).
Used only for farm-specific tuning; no fabricated learning.

## Satellite readiness model
`getSatelliteProviderStatus()` → `UNCONFIGURED` (no credential read,
no client). `correlateSatellite()` → `{ status:'UNCONFIGURED',
satelliteConfidence:null, reading:{ ndvi:null, ndmi:null,
vegetationStress:null } }`. The gate fails the build if any NDVI/
stress field is ever assigned a number. This is the foundation that
makes connecting satellite later a one-file change — and makes
faking it impossible.

## Build gates (§11)
`check:farm-brain` now also fails if: FarmBrainRuntime / CropStageEngine
/ Satellite trio / AdaptiveTaskGenerator / FarmScanMemory missing; a
task lacks reason or confidence; CropStage fakes a stage; any
satellite index gets a numeric value; the 7 readiness flags drop.
Farm-Health / Today's-Action / Crop-Stage presence is covered here +
by `check:digital-agronomist` + `check:command-center`.

## Build results
`build:safe` — `check:farm-brain` extended; full run green (commit).

## KPI Impact (Founder Decision Rule)
Foundation/measurement sprint. CropStageEngine + AdaptiveTaskGenerator
make **Today's Action** stage-specific (quality → completion); the
satellite stub removes the temptation to fabricate. No north-star
moves until pilot farmers generate the histories these engines read —
which remains the one true unlock.

## Path note
The spec wrote `src/runtime/farmbrain/` (lowercase); the existing
#207 directory is `src/runtime/farmBrain/` (capital B) and is
gate-/import-wired. Creating a second case-variant directory would
collide on case-insensitive filesystems and break the Linux build, so
all files live in the existing `farmBrain/`. Functionally identical.
