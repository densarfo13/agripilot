/**
 * src/core/taskEngine/index.js — import surface for the
 * task intelligence layer.
 */

export {
  STAGE, ACTION_TYPE, FLAG,
  tasksForStage, taskByCode, stageGateCodes, TASK_CATALOG,
} from './stageTaskMap.js';

export {
  scoreTaskPriority, scoreAll,
} from './priorityScorer.js';

export {
  generateFarmTasks, recomputeAfterCompletion,
  selectPrimaryTask, shouldAdvanceStage,
} from './taskGenerator.js';

export {
  assertNoGenericWhenContextExists,
  assertSinglePrimary,
  assertPrimaryExists,
  assertCompletedNotPrimary,
  assertRebuildAfterCompletion,
  assertWeatherNotDominant,
  assertEngineReturnedPayload,
} from './taskDevAssertions.js';
