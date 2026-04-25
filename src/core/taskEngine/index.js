/**
 * src/core/taskEngine/index.js — import surface for the
 * task intelligence layer.
 *
 * ⚠ NOT LIVE IN PRODUCTION
 *   The fix plan (P2.6) asked to make this file canonical and
 *   remove src/lib/dailyTasks/taskEngine.js, but verification
 *   showed src/lib/dailyTasks/taskScheduler.js (the actual
 *   scheduler the dashboard uses) imports `generateDailyTasks`
 *   from the legacy engine, NOT `generateFarmTasks` from here.
 *   Making this file canonical would break the live wiring.
 *
 * Status: orphan / experimental. No production code path imports
 * `generateFarmTasks` from this module today (grep -r confirms).
 *
 * To unify, do this in a follow-up PR (out of pilot scope):
 *   1. Migrate src/lib/dailyTasks/taskScheduler.js to import
 *      generateFarmTasks + selectPrimaryTask from this index.
 *   2. Run the full task suite to confirm parity.
 *   3. Delete src/lib/dailyTasks/taskEngine.js.
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
