/**
 * modeAwareTasks.js — backyard / farm task shaping.
 *
 * Backyard task output is intentionally sparser:
 *   - one primary task
 *   - max one secondary task (not two)
 *   - titles simplified where we can
 *   - no "stage X" jargon in the surface wording
 *
 * Farm output passes through unchanged — the underlying task engine
 * already produces the richer surface.
 *
 *   simplifyBackyardTasks(tasks) → Array
 *   shapeTodayPayloadForMode(payload, mode) → payload
 *
 * Pure; the backend or Today page wraps buildTodayFeed's output
 * through shapeTodayPayloadForMode before rendering.
 */

// Titles the farm engine produces that read heavy for a home grower.
// Keys are lowercase substrings to match; values are i18n keys the
// UI can resolve (falling back to the original title if unknown).
const BACKYARD_TITLE_REWRITES = [
  [/side[- ]?dress/i, 'backyardTask.feed'],
  [/scout.*rows/i,    'backyardTask.checkLeaves'],
  [/deep[- ]?water/i, 'backyardTask.waterDeeply'],
  [/thin\b/i,         'backyardTask.thinSeedlings'],
  [/stake|cage/i,     'backyardTask.supportPlants'],
  [/harvest/i,        'backyardTask.pickRipe'],
];

function rewriteTitle(title, t) {
  if (!title || !t) return title;
  for (const [pattern, key] of BACKYARD_TITLE_REWRITES) {
    if (pattern.test(title)) {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
  }
  return title;
}

/**
 * simplifyBackyardTasks — strips stage jargon out of details, caps
 * list length, and rewrites titles through backyardTask.* keys when
 * a translator is provided.
 */
export function simplifyBackyardTasks(tasks = [], t = null) {
  if (!Array.isArray(tasks)) return [];
  return tasks.slice(0, 1).map((task) => ({
    ...task,
    title: rewriteTitle(task.title, t),
    detail: stripStageJargon(task.detail),
  }));
}

function stripStageJargon(detail) {
  if (!detail) return detail;
  return String(detail)
    .replace(/\bstage\s+\w+\s*[.:]?\s*/gi, '')
    .replace(/\bweek\s*\d+\s*[.:]?\s*/gi, '')
    .trim();
}

/**
 * shapeTodayPayloadForMode — returns a new payload with
 * mode-appropriate caps + title rewrites.
 *
 *   backyard: 1 primary + max 1 secondary + optional checks capped
 *             at 1; no weather-badge, no weatherAlerts array beyond
 *             a single most-important entry.
 *   farm:     unchanged.
 */
export function shapeTodayPayloadForMode(payload = {}, mode = 'farm', t = null) {
  if (mode !== 'backyard') return payload;

  return {
    ...payload,
    primaryTask: payload.primaryTask
      ? { ...payload.primaryTask,
          title: rewriteTitle(payload.primaryTask.title, t),
          detail: stripStageJargon(payload.primaryTask.detail) }
      : null,
    secondaryTasks: (payload.secondaryTasks || []).slice(0, 1).map((task) => ({
      ...task,
      title: rewriteTitle(task.title, t),
      detail: stripStageJargon(task.detail),
    })),
    weatherAlerts: (payload.weatherAlerts || []).slice(0, 1),
    riskAlerts: (payload.riskAlerts || []).slice(0, 2),
    optionalChecks: (payload.optionalChecks || []).slice(0, 1),
    // Heavy analytics hidden; the status pill still renders because
    // it's tied to `progress`, not this field.
    behaviorSummary: null,
    debug: undefined,
  };
}

/**
 * Convenience so callers that already have an array of generated
 * tasks can cap + rewrite them without building a full payload.
 */
export function generateBackyardTasks(tasks, t) {
  return simplifyBackyardTasks(tasks, t);
}

export function generateFarmTasks(tasks) {
  return Array.isArray(tasks) ? tasks : [];
}

export const _internal = { BACKYARD_TITLE_REWRITES, stripStageJargon, rewriteTitle };
