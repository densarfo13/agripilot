# SCAN_STATUS_MATRIX — field → tier → current status

Current truthful state of every classified scan field (with the wired providers:
crop calendar, live weather, server-side soil; CV models NOT deployed).

| Field | Tier | Status today | Value source |
|---|---|---|---|
| fruitCount, flowerCount, leafCount, leafDamagePct, diseaseLesions, canopyCoverage, objectDimensions, plantPopulation, gapDetection, rowAlignment | 1 DIRECT_MEASURED | awaiting_model | a CV model (not deployed) |
| plantAge, maturityDate, harvestWindow, growthVelocity | 2 MODEL_ESTIMATED | **estimated** ✅ | crop-calendar model |
| yieldEstimate, biomass, ripeness, stress, healthScore, recoveryProbability | 2 MODEL_ESTIMATED | awaiting_model | a CV estimation model |
| diseaseRisk, yieldForecast, harvestDateForecast | 3 FUSED_ESTIMATE | awaiting_model | image+weather+soil+history fusion |
| rainRisk, frostRisk, heatRisk, windRisk | 4 LIVE_PROVIDER | **live** ✅ | live weather provider |
| soilPh, soilMoisture | 4 LIVE_PROVIDER | live (with soil ctx) ✅ | SoilGrids/Ambee |
| marketPrice, satelliteNdvi, droneAnalysis, iotSensors | 4 LIVE_PROVIDER | awaiting_provider | feed not wired |
| nitrogen, phosphorus, potassium, organicMatter, cec, micronutrients | 5 LAB_REQUIRED | awaiting_lab | soil laboratory test |

**Legend:** `estimated`/`live` = a real value is produced now; `awaiting_*` = honest
gap with the named path to a value; nothing here is fabricated.
