/**
 * src/runtime/satellite/index.ts — barrel.
 */

export {
  evaluate,
  satelliteIntelligenceHealth, installSatelliteIntelligenceGlobal,
  type SatelliteEvaluateInput,
} from './SatelliteRuntime';

export {
  evaluateNDVI, NDVI_ENGINE_VERSION,
  type NDVIInput, type NDVIOutput,
} from './NDVIEngine';

export {
  evaluateMoistureStress, MOISTURE_ENGINE_VERSION,
  type MoistureInput,
} from './MoistureStressEngine';

export {
  evaluateHeatStress, HEAT_ENGINE_VERSION,
  type HeatInput,
} from './HeatStressEngine';

export {
  evaluateVegetationTrend, VEGETATION_TREND_ENGINE_VERSION,
  type VegetationTrendInput, type VegetationTrendOutput,
} from './VegetationTrendEngine';

export {
  evaluateBoundary, BOUNDARY_ENGINE_VERSION,
  type BoundaryInput, type BoundaryOutput,
} from './FarmBoundarySignalEngine';

export {
  SATELLITE_RUNTIME_VERSION,
  VEGETATION_HEALTH, NDVI_TREND, STRESS_LEVEL,
  SATELLITE_BANNED_WORDING,
  type VegetationHealthValue, type NDVITrendValue, type StressLevelValue,
  type SatelliteResult, type SatelliteHealth,
} from './satelliteContracts';
