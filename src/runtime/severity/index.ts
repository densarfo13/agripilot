/**
 * src/runtime/severity/index.ts — Severity suite barrel.
 */

export {
  evaluate, getLatestSeverityForPlant, listSeverityHistoryForPlant,
  severityHealth, installSeverityGlobal,
  type SeverityEvaluateInput,
} from './SeverityRuntime';

export {
  SEVERITY_RUNTIME_VERSION, SEVERITY_LEVEL,
  SEVERITY_STORAGE_KEY, SEVERITY_HISTORY_CAP,
  SEVERITY_BANNED_WORDING,
  type SeverityLevelValue,
  type SeverityResult, type SeverityHealth,
} from './severityContracts';
