/**
 * dailyBriefingEngine.js — turns the intelligence snapshot into
 * calm, farmer-vs-garden daily notification messages.
 *
 *   import { generateDailyBriefingNotifications }
 *     from 'src/core/notifications/dailyBriefingEngine.js';
 *
 *   const notes = generateDailyBriefingNotifications();
 *   //  → [{ id, kind, urgency, mode, title, body, language }, …]
 *   //    at most 2 entries, urgency-ordered.
 *
 * What this is
 * ────────────
 *   The notification DELIVERY layer already ships — notificationService
 *   (push/permission), notificationPreferences (opt-in + quiet hours),
 *   notificationStore (the in-app centre), notificationHistory (dedupe).
 *   What was missing is the module that decides WHAT to say: it reads
 *   the predictive briefing and shapes ≤2 calm messages, tailored to
 *   farm vs garden mode.
 *
 *   It consumes getPredictiveBriefing() — which consumes
 *   getIntelligenceSnapshot() — so it never bypasses the canonical
 *   snapshot and never re-derives a risk or a task itself. No
 *   duplicate recommendation logic.
 *
 * Spec rules honoured
 *   • Max 2 notifications (§3 cap, applied at generation).
 *   • Urgency priority: scan/risk → task → harvest/market (§3, §4).
 *   • Farmer vs gardener framing (§2, §5).
 *   • No generic "open app" reminders — every message names a real
 *     signal and a next action.
 *   • Quiet hours / opt-in / dedupe / push-vs-in-app are the
 *     delivery layer's job; this engine only produces candidates.
 *
 * Strict-rule audit
 *   • Pure (modulo the snapshot's cache reads). Never throws.
 *   • No PII. No raw API output. SSR-safe.
 */

import { getPredictiveBriefing } from '../prediction/getPredictiveBriefing.js';
import { getCropLabel } from '../intelligence/agricultureRegistry.js';

const _LEVEL_RANK = { high: 3, medium: 2, low: 1 };
const _rank = (u) => _LEVEL_RANK[String(u || '').toLowerCase()] || 0;

const _todayKey = () => {
  try { return new Date().toISOString().slice(0, 10); }
  catch { return 'today'; }
};

/** A calm crop noun for the active mode + crop. */
function _cropNoun(briefing) {
  try {
    const crop = briefing && briefing.cropStatus && briefing.cropStatus.crop;
    const lang = (briefing && briefing.geo && briefing.geo.language) || 'en';
    if (crop) {
      const label = getCropLabel(crop, lang);
      if (label && typeof label === 'string') return label.toLowerCase();
    }
  } catch { /* fall through */ }
  const mode = briefing && briefing.cropStatus && briefing.cropStatus.mode;
  return mode === 'garden' ? 'plants' : 'crop';
}

/**
 * Generate the day's briefing notifications — at most 2, ordered
 * most-urgent first. Never throws.
 *
 * @param {object} [options]  forwarded to getPredictiveBriefing
 * @returns {Array<{id:string,kind:string,urgency:string,mode:string,title:string,body:string,language:string}>}
 */
export function generateDailyBriefingNotifications(options) {
  let briefing;
  try {
    briefing = getPredictiveBriefing(options);
  } catch {
    briefing = null;
  }
  if (!briefing) return [];

  const mode = (briefing.cropStatus && briefing.cropStatus.mode === 'garden')
    ? 'garden' : 'farm';
  const language = (briefing.geo && briefing.geo.language) || 'en';
  const noun = _cropNoun(briefing);
  const day = _todayKey();
  const candidates = [];

  // ── 1. Top predicted risk — weather / disease / pest ──────────
  //    The strongest signal; spec §3 priority 1-2.
  const topRisk = briefing.topRisk;
  if (topRisk && topRisk.headline) {
    const action = topRisk.action ? (' ' + topRisk.action) : '';
    candidates.push({
      id:       `briefing-risk-${topRisk.kind || 'risk'}-${day}`,
      kind:     'weather_risk',
      urgency:  topRisk.level || 'medium',
      mode,
      title:    mode === 'garden' ? 'Garden check today' : 'Field check today',
      body:     String(topRisk.headline) + action,
      language,
    });
  }

  // ── 2. Priority task — the calm next action ───────────────────
  const task = briefing.priorityTask;
  if (task && task.title) {
    candidates.push({
      id:       `briefing-task-${day}`,
      kind:     'task_reminder',
      urgency:  task.urgency || 'medium',
      mode,
      title:    mode === 'garden' ? 'Today in your garden' : 'Today on your farm',
      body:     mode === 'garden'
        ? String(task.title)
        : `${String(task.title)} — your ${noun} will thank you.`,
      language,
    });
  }

  // ── 3. Harvest / market readiness (farm) — lowest priority ────
  const stage = String((briefing.cropStatus && briefing.cropStatus.cropStage) || '').toLowerCase();
  if (mode === 'farm' && (stage.includes('harvest') || stage.includes('mature'))) {
    candidates.push({
      id:       `briefing-harvest-${day}`,
      kind:     'harvest_ready',
      urgency:  'low',
      mode,
      title:    'Harvest window',
      body:     `Your ${noun} is near harvest — check readiness and plan your sale.`,
      language,
    });
  }

  // Urgency-order + hard cap at 2 (spec §3).
  candidates.sort((a, b) => _rank(b.urgency) - _rank(a.urgency));
  return candidates.slice(0, 2);
}

/**
 * The single most important briefing notification, or null when
 * the day is calm. Convenience for a "morning briefing" surface.
 *
 * @param {object} [options]
 * @returns {?object}
 */
export function getMorningBriefingNotification(options) {
  const notes = generateDailyBriefingNotifications(options);
  return notes.length > 0 ? notes[0] : null;
}

const _module = {
  generateDailyBriefingNotifications,
  getMorningBriefingNotification,
};
export default _module;
