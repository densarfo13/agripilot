/**
 * Farmer Icon System — centralized icon mapping for all farmer-facing UI.
 *
 * Same concept = same icon everywhere. No random icon changes between screens.
 * Icons support navigation and scanning, not decoration.
 */

// ─── Navigation icons ───────────────────────────────────────
export const NAV_ICONS = {
  home: '\uD83C\uDFE0',       // 🏠
  farm: '\uD83C\uDF31',       // 🌱
  tasks: '\u2705',             // ✅
  progress: '\uD83D\uDCCA',   // 📊
  // Standardize Navigation System §1 — Scan is now a top-level
  // tab on the unified 5-tab nav (Home / My Grow / Tasks /
  // Progress / Scan).
  scan: '\uD83D\uDCF7',       // 📷
  sell: '\uD83C\uDFF7\uFE0F',         // 🏷️  (kept for legacy /sell route)
  opportunities: '\uD83C\uDFAF',      // 🎯  (kept for legacy /opportunities)
};

// ─── Section icons (used in headers / labels) ───────────────
export const SECTION_ICONS = {
  currentTask: '\uD83C\uDFAF',  // 🎯
  nextTasks: '\uD83D\uDCCB',    // 📋
  onTrack: '\u2705',             // ✅
  weather: '\uD83C\uDF24',      // 🌤
  crop: '\uD83C\uDF3E',         // 🌾
  location: '\uD83D\uDCCD',     // 📍
  water: '\uD83D\uDCA7',        // 💧
  pests: '\uD83D\uDC1B',        // 🐛
  growth: '\uD83C\uDF3F',       // 🌿
  plan: '\uD83D\uDCCB',         // 📋
  weeklyActivity: '\uD83D\uDCC5', // 📅
  completed: '\u2705',           // ✅
  size: '\uD83D\uDCD0',         // 📐
  country: '\uD83C\uDF0D',      // 🌍
  stage: '\uD83C\uDF31',        // 🌱
};

// ─── Task action type icons ─────────────────────────────────
export const TASK_ACTION_ICONS = {
  drying: '\uD83C\uDFAF',      // 🎯
  planting: '\uD83C\uDF31',    // 🌱
  pests: '\uD83D\uDC1B',       // 🐛
  watering: '\uD83D\uDCA7',    // 💧
  weeding: '\uD83C\uDF3F',     // 🌿
  fertilizing: '\uD83E\uDDEA', // 🧪
  harvesting: '\uD83C\uDF3E',  // 🌾
  spraying: '\uD83D\uDCA8',    // 💨
  monitoring: '\uD83D\uDD0D',  // 🔍
  storage: '\uD83D\uDCE6',     // 📦
  selling: '\uD83D\uDCB0',     // 💰
};

/**
 * Get icon for a task based on its actionType.
 * Falls back to 🎯 (current task).
 */
export function getTaskActionIcon(actionType) {
  if (!actionType) return SECTION_ICONS.currentTask;
  return TASK_ACTION_ICONS[actionType] || SECTION_ICONS.currentTask;
}
