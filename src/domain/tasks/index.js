/**
 * Task Domain — barrel export.
 *
 * This is the public API for the task domain layer.
 * UI components import from here, not from internal files.
 */
export { buildFarmerTaskViewModel, buildTaskListViewModels, TASK_VIEWMODEL_SCHEMA_VERSION } from './buildFarmerTaskViewModel.js';
export { getTaskSeverity } from './getTaskSeverity.js';
export { getTaskStateStyle } from './taskStateStyles.js';
export { resolveFarmerText } from './farmerTextResolver.js';
export { assertViewModel, assertIsViewModel, assertTranslation, assertWeatherOverrideConsistency } from './devAssertions.js';
