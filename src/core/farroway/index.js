/**
 * index.js — Farroway core barrel.
 *
 * Single import surface for the merged Farroway core (Task Engine
 * + Settings + Notifications + SMS + NGO Alerts).
 *
 *   import {
 *     getCurrentFarm, saveFarm,
 *     loadSettings, updateSetting,
 *     generateDailyTask,
 *     markTaskDone,
 *     speak,
 *     sendSMS,
 *     runDailyReminder,
 *     generateAlerts,
 *     TodayCard,
 *     initFarrowayCore,
 *   } from './core/farroway';
 *
 * Each underlying module is also importable directly when callers
 * want a narrower bundle / clearer dep graph.
 */

// 1. FARM STORE
export {
  getCurrentFarm,
  saveFarm,
  updateFarm,
  FARM_KEY,
} from './farmStore.js';

// 2. SETTINGS STORE — re-export the existing canonical store so
//    every consumer of Farroway core lands on the same data.
export {
  loadSettings,
  saveSettings,
  updateSetting,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SETTINGS_CHANGE_EVENT,
} from '../../store/settingsStore.js';

// 3. TASK ENGINE
export {
  generateDailyTask,
  getDaysSincePlanting,
  getStage,
  TASK_RULES,
  STAGES,
} from './taskEngine.js';

// 4. PROGRESS STORE
export {
  markTaskDone,
  getProgress,
  resetProgress,
  getCompletedCount,
  PROGRESS_KEY,
} from './progressStore.js';

// 5. VOICE
export { speak } from './voice.js';

// 6. SMS SERVICE
export { sendSMS } from './smsService.js';

// 7. NOTIFICATION SYSTEM
export {
  runDailyReminder,
  LAST_NOTIFICATION_KEY,
} from './notificationSystem.js';
export { getTaskMessage, TASK_MESSAGE_MAP } from './taskMessages.js';

// 8. NGO ALERT ENGINE
export { generateAlerts, ALERT_TYPE } from './ngoAlerts.js';

// 9. UI
export { default as TodayCard } from './TodayCard.jsx';

// 10. APP INIT
export { initFarrowayCore, stopFarrowayCore, TICK_INTERVAL_MS } from './init.js';
