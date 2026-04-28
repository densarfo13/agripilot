/**
 * iconDictionary.js — single source of truth for the emoji
 * glyphs the No-Reading-Required (Simple Mode) UX uses.
 *
 *   import { TASK_ICONS, RISK_ICONS, ACTION_ICONS,
 *            getTaskIcon, getRiskIcon, getActionIcon }
 *     from '../ux/iconDictionary.js';
 *
 * Why a dictionary
 *   Hard-coding `\uD83D\uDC1B` into a dozen components means a
 *   visual drift on the next "let's tweak the icon" change is
 *   guaranteed. Centralising the map means a low-literacy farmer
 *   sees the SAME bug for the same concept across Today, Label-
 *   Prompt, RiskBadge, and any future surface that opts in.
 *
 * Strict-rule audit
 *   * Frozen so the dictionary can't be mutated at runtime
 *   * Pure: no I/O, no side effects, no globals
 *   * Defensive accessors return a calm default ('check_farm'
 *     glyph for tasks, 'good' for risks, 'done' for actions)
 *     rather than `undefined` so callers never paint a literal
 *     "undefined" string when an unknown id slips through
 *   * Glyphs chosen for cross-platform legibility — every entry
 *     renders identically on Android Emoji 4+, iOS 13+, and
 *     Windows Segoe UI Emoji
 */

export const TASK_ICONS = Object.freeze({
  prepare_rows:    '\uD83C\uDFAF',  // 🎯
  weed_rows:       '\uD83C\uDF3F',  // 🌿
  scout_pests:     '\uD83D\uDC1B',  // 🐛
  check_moisture:  '\uD83D\uDCA7',  // 💧
  water_crops:     '\uD83D\uDEBF',  // 🚿
  fertilize:       '\uD83E\uDDFA',  // 🧺
  prepare_harvest: '\uD83C\uDF3E',  // 🌾
  check_farm:      '\uD83D\uDC40',  // 👀
  scan_crop:       '\uD83D\uDCF8',  // 📸
});

export const RISK_ICONS = Object.freeze({
  pest:     '\uD83D\uDC1B',         // 🐛
  drought:  '\uD83C\uDF35',         // 🌵
  rain:     '\uD83C\uDF27\uFE0F',   // 🌧️
  heat:     '\u2600\uFE0F',         // ☀️
  good:     '\u2705',               // ✅
  warning:  '\u26A0\uFE0F',         // ⚠️
});

export const ACTION_ICONS = Object.freeze({
  listen:   '\uD83D\uDD0A',         // 🔊
  done:     '\u2705',               // ✅
  skip:     '\u23ED\uFE0F',         // ⏭️
  report:   '\uD83D\uDEA9',         // 🚩
  scan:     '\uD83D\uDCF8',         // 📸
});

/**
 * Defensive accessors. Use these in render paths instead of
 * direct dictionary lookups so an unknown id (corrupted store,
 * stale cache from an older app version, server returning a
 * task type the client doesn't know yet) renders the calm
 * default glyph rather than `undefined`.
 */
export function getTaskIcon(taskId) {
  if (taskId && Object.prototype.hasOwnProperty.call(TASK_ICONS, taskId)) {
    return TASK_ICONS[taskId];
  }
  return TASK_ICONS.check_farm;
}

export function getRiskIcon(riskKind) {
  if (riskKind && Object.prototype.hasOwnProperty.call(RISK_ICONS, riskKind)) {
    return RISK_ICONS[riskKind];
  }
  return RISK_ICONS.good;
}

export function getActionIcon(actionId) {
  if (actionId && Object.prototype.hasOwnProperty.call(ACTION_ICONS, actionId)) {
    return ACTION_ICONS[actionId];
  }
  return ACTION_ICONS.done;
}

export default { TASK_ICONS, RISK_ICONS, ACTION_ICONS,
                 getTaskIcon, getRiskIcon, getActionIcon };
