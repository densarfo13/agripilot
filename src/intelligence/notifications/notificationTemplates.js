/**
 * notificationTemplates — calm, action-framed copy library.
 *
 * SPEC §3 + §17
 *   • Title: short contextual statement.
 *   • Body:  one useful insight + optional action.
 *   • CTA:   optional quick action.
 *   • Tone:  Google-Weather-style calm.
 *
 * RULES
 *   • Templates accept a flat `vars` object. Substitution uses
 *     `{name}` placeholders so a missing var renders the literal
 *     placeholder (visible to QA, never crashes).
 *   • Every template ALSO carries an English fallback that's
 *     safe to show on its own — translators can splice the
 *     locale columns later via the standard tSafe pattern.
 *   • Forbidden phrasing (alarms, fraud, AI, percentages) is
 *     absent by construction. The engine adds a final-net
 *     safety filter as a defence-in-depth measure.
 */

import { PRIORITY } from './notificationPriority.js';

// Each template is keyed by `kind:variant` so the engine can
// resolve a candidate without inspecting strings.
//
// `kind` matches the deduplication kind so the engine and
// dedup map stay in sync.
export const TEMPLATES = Object.freeze({
  // ─── Weather ────────────────────────────────────────────────
  'weather:rain': {
    priority: PRIORITY.IMPORTANT,
    titleFb:  'Rain expected{regionSuffix}',
    bodyFb:   'Check drainage around young crops.',
    actionLabelFb: 'Start check',
    actionRoute: '/tasks',
    titleKey: 'notif.weather.rain.title',
    bodyKey:  'notif.weather.rain.body',
    actionKey: 'notif.weather.rain.action',
  },
  'weather:heat': {
    priority: PRIORITY.NORMAL,
    titleFb:  'Warm afternoon expected today',
    bodyFb:   'Check moisture in smaller gardens.',
    actionLabelFb: 'Check soil',
    actionRoute: '/scan/soil',
    titleKey: 'notif.weather.heat.title',
    bodyKey:  'notif.weather.heat.body',
    actionKey: 'notif.weather.heat.action',
  },
  'weather:wind': {
    priority: PRIORITY.NORMAL,
    titleFb:  'Strong wind possible later',
    bodyFb:   'Secure lighter plants if needed.',
    actionLabelFb: 'See tasks',
    actionRoute: '/tasks',
    titleKey: 'notif.weather.wind.title',
    bodyKey:  'notif.weather.wind.body',
    actionKey: 'notif.weather.wind.action',
  },
  'weather:cold': {
    priority: PRIORITY.NORMAL,
    titleFb:  'Cool overnight temperatures expected',
    bodyFb:   'Consider protecting sensitive crops.',
    actionLabelFb: 'See tasks',
    actionRoute: '/tasks',
    titleKey: 'notif.weather.cold.title',
    bodyKey:  'notif.weather.cold.body',
    actionKey: 'notif.weather.cold.action',
  },

  // ─── Tasks ──────────────────────────────────────────────────
  'task:morning': {
    priority: PRIORITY.NORMAL,
    titleFb:  'You have {count} important task today',
    bodyFb:   'Quick soil check recommended.',
    actionLabelFb: 'Open today',
    actionRoute: '/tasks',
    titleKey: 'notif.task.morning.title',
    bodyKey:  'notif.task.morning.body',
    actionKey: 'notif.task.morning.action',
  },
  'task:complete': {
    priority: PRIORITY.LOW,
    titleFb:  'Nice work — today’s tasks are complete',
    bodyFb:   'Take a moment to enjoy the progress.',
    actionLabelFb: 'See progress',
    actionRoute: '/progress',
    titleKey: 'notif.task.complete.title',
    bodyKey:  'notif.task.complete.body',
    actionKey: 'notif.task.complete.action',
  },
  'task:missed': {
    priority: PRIORITY.NORMAL,
    titleFb:  'Your crop may need a quick check today',
    bodyFb:   'Open today’s task list when you have a minute.',
    actionLabelFb: 'Open today',
    actionRoute: '/tasks',
    titleKey: 'notif.task.missed.title',
    bodyKey:  'notif.task.missed.body',
    actionKey: 'notif.task.missed.action',
  },
  'task:stage_progress': {
    priority: PRIORITY.LOW,
    titleFb:  'Your {crop} is entering early growth',
    bodyFb:   'A short check today helps keep it on track.',
    actionLabelFb: 'See progress',
    actionRoute: '/progress',
    titleKey: 'notif.task.stage.title',
    bodyKey:  'notif.task.stage.body',
    actionKey: 'notif.task.stage.action',
  },

  // ─── Scan ───────────────────────────────────────────────────
  'scan_followup:default': {
    priority: PRIORITY.NORMAL,
    titleFb:  'Scan follow-up recommended',
    bodyFb:   'Your recent scan may need a follow-up check.',
    actionLabelFb: 'Open scan',
    actionRoute: '/scan',
    titleKey: 'notif.scan.followup.title',
    bodyKey:  'notif.scan.followup.body',
    actionKey: 'notif.scan.followup.action',
  },
  'scan:improvement': {
    priority: PRIORITY.LOW,
    titleFb:  'Your plants look healthier',
    bodyFb:   'Leaves look healthier after the last update.',
    actionLabelFb: 'See progress',
    actionRoute: '/progress',
    titleKey: 'notif.scan.improvement.title',
    bodyKey:  'notif.scan.improvement.body',
    actionKey: 'notif.scan.improvement.action',
  },
  'scan:retake': {
    priority: PRIORITY.LOW,
    titleFb:  'Try another scan in brighter light',
    bodyFb:   'A clearer photo helps the next check.',
    actionLabelFb: 'Open scan',
    actionRoute: '/scan',
    titleKey: 'notif.scan.retake.title',
    bodyKey:  'notif.scan.retake.body',
    actionKey: 'notif.scan.retake.action',
  },

  // ─── Buyer / Sell ──────────────────────────────────────────
  'buyer:interest_nearby': {
    priority: PRIORITY.IMPORTANT,
    titleFb:  'Buyer interest near {region}',
    bodyFb:   'Your produce listing received attention.',
    actionLabelFb: 'See buyer',
    actionRoute: '/sell',
    titleKey: 'notif.buyer.interest.title',
    bodyKey:  'notif.buyer.interest.body',
    actionKey: 'notif.buyer.interest.action',
  },
  'buyer:demand_up': {
    priority: PRIORITY.LOW,
    titleFb:  'Fresh produce demand increased nearby',
    bodyFb:   'A clear photo helps your listing stand out.',
    actionLabelFb: 'Open sell',
    actionRoute: '/sell',
    titleKey: 'notif.buyer.demand.title',
    bodyKey:  'notif.buyer.demand.body',
    actionKey: 'notif.buyer.demand.action',
  },

  // ─── Funding ───────────────────────────────────────────────
  'funding:opportunity_nearby': {
    priority: PRIORITY.NORMAL,
    titleFb:  'New farming support opportunity available nearby',
    bodyFb:   'You may qualify for a local agriculture program.',
    actionLabelFb: 'Check eligibility',
    actionRoute: '/funding',
    titleKey: 'notif.funding.opportunity.title',
    bodyKey:  'notif.funding.opportunity.body',
    actionKey: 'notif.funding.opportunity.action',
  },

  // ─── Progress (evening summary) ────────────────────────────
  'progress:evening_summary': {
    priority: PRIORITY.LOW,
    titleFb:  'Your day on the farm',
    bodyFb:   'You moved steadily today — keep the rhythm.',
    actionLabelFb: 'See progress',
    actionRoute: '/progress',
    titleKey: 'notif.progress.evening.title',
    bodyKey:  'notif.progress.evening.body',
    actionKey: 'notif.progress.evening.action',
  },
});

/**
 * Render a template with the supplied vars. Missing vars leave
 * the literal `{name}` placeholder visible to QA — never throws.
 *
 * @param {string} template
 * @param {object} vars
 * @returns {string}
 */
export function renderTemplate(template, vars) {
  if (!template || typeof template !== 'string') return '';
  if (!vars || typeof vars !== 'object') return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const v = vars[key];
    if (v == null || v === '') {
      // For special "regionSuffix"-style placeholders, an empty
      // value resolves to "" (no leading space), so the title
      // stays clean when region is unknown.
      if (key === 'regionSuffix') return '';
      // Default — leave the literal placeholder so the missing
      // value is visible to QA but never crashes the render.
      return `{${key}}`;
    }
    return String(v);
  });
}

/**
 * Resolve a template by `id` (`kind:variant`). Returns null
 * when unknown so the engine can drop the candidate silently
 * instead of rendering "undefined".
 *
 * @param {string} id
 * @returns {object|null}
 */
export function resolveTemplate(id) {
  if (!id || typeof id !== 'string') return null;
  return TEMPLATES[id] || null;
}

const _module = { TEMPLATES, renderTemplate, resolveTemplate };
export default _module;
