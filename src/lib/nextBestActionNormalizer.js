/**
 * nextBestActionNormalizer.js — emit the production-trust spec's
 * exact 9-field shape from the existing computeNextBestAction
 * result + the unified intelligence snapshot.
 *
 *   const normalized = normalizeNextBestAction(snapshot);
 *   // → {
 *   //     noticed,          // what we noticed (one short phrase)
 *   //     meaning,          // what it means (plain language)
 *   //     action,           // what to do today
 *   //     bestTime,         // when to do it (today / morning / etc.)
 *   //     estimatedMinutes, // rough effort
 *   //     confidenceTone,   // "Possible..." / "Likely..." — never %
 *   //     sourceContext,    // tiny tag set: weather / scan / task / health / pattern
 *   //     ctaLabel,         // one-tap button label
 *   //     ctaRoute,         // route the button navigates to
 *   //   }  |  null
 *
 * Why a normalizer
 * ────────────────
 *   The production-trust spec asks for a SPECIFIC shape that's
 *   different from my existing computeNextBestAction return:
 *     existing  → { kind, title, reason, urgency, confidence,
 *                   impact, actionType, dedupeKey, hint, sourceRef }
 *     spec      → { noticed, meaning, action, bestTime,
 *                   estimatedMinutes, confidenceTone, sourceContext,
 *                   ctaLabel, ctaRoute }
 *
 *   The existing engine has consumers (NextBestActionCard,
 *   DailyBriefingCard, farmIntelligenceSnapshot) — changing its
 *   shape would break them. The normalizer is the honest move:
 *   keep the engine as-is, add a thin adapter that emits the
 *   spec shape so new code can consume it cleanly.
 *
 *   This also enforces the spec's "never expose raw NDVI, model
 *   JSON, or API output" rule: the normalizer is the choke point
 *   that decides which engine fields surface to the UI and how
 *   they're worded.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Returns null when the engine returned null (calm fallback
 *     is handled by the engine itself).
 *   • confidenceTone uses plain-language framing — "Possible …",
 *     "Likely …", "Calm signal" — never percentages and never
 *     raw confidence words.
 *   • ctaRoute is always a relative path the existing router
 *     already knows ('/scan', '/today', '/'). No invention.
 */

// ─── Effort estimates per action kind ────────────────────────
// Calm rounded minutes. Real-world variability is large — these
// are "a calm advisor's rough estimate," not stopwatch numbers.
// Spec calls for `estimatedMinutes` so the user can decide
// whether they have time before they tap in.
const _EFFORT_MINUTES = Object.freeze({
  spray:    25,
  treat:    30,
  water:    15,
  irrigate: 20,
  drain:    20,
  inspect:  10,
  review:    5,    // "open Today's Plan and clear tasks"
  fertilize: 30,
  harvest:  60,
});

// ─── Action-kind → bestTime narrative ─────────────────────────
// Spec calls for `bestTime` as a calm window ("This morning",
// "Before sunset", etc.), not a clock time.
function _bestTimeFor(action) {
  const kind = String(action && action.actionType || '').toLowerCase();
  // Risk-derived actions carry their own implicit timing.
  if (action && typeof action.kind === 'string' && action.kind.startsWith('risk_high:')) {
    if (kind === 'spray')   return 'This evening, before sunset';
    if (kind === 'water')   return 'At dawn or after sunset';
    if (kind === 'drain')   return 'Before any rain arrives';
  }
  switch (kind) {
    case 'spray':     return 'This evening, before sunset';
    case 'water':     return 'At dawn or after sunset';
    case 'irrigate':  return 'At dawn or after sunset';
    case 'drain':     return 'Before the next rain';
    case 'fertilize': return 'On a calm, dry day';
    case 'harvest':   return 'Mid-morning, when leaves are dry';
    case 'inspect':   return 'When you walk the field today';
    case 'review':    return 'When you have a free moment';
    default:          return 'Today';
  }
}

// ─── Action-kind → confidenceTone phrase ──────────────────────
// Spec rule: low confidence MUST read as "Possible …", never as
// certainty.
function _confidenceTone(action) {
  if (!action) return null;
  const c = String(action.confidence || '').toLowerCase();
  const k = String(action.kind || '');
  if (k === 'fallback_walk')          return 'Calm signal';
  if (k.startsWith('risk_medium:'))   return 'Possible — worth watching';
  if (k.startsWith('risk_high:'))     return 'Likely — multiple signals agree';
  if (k === 'pattern_worsening')      return 'Possible — your last rescan looked worse';
  if (k === 'scan_followup')          return 'Possible — follow-up on your last scan';
  if (k === 'health_urgent')          return 'Strong — multiple signs together';
  if (c === 'high')   return 'Likely';
  if (c === 'medium') return 'Possible — worth watching';
  return 'Possible';
}

// ─── Action-kind → sourceContext tag set ─────────────────────
// Spec calls for `sourceContext` as a small tag list so the UI
// can render "based on: weather + scan" without exposing raw data.
function _sourceContextFor(action) {
  if (!action) return [];
  const tags = new Set();
  const k = String(action.kind || '');
  if (k.startsWith('risk_high:') || k.startsWith('risk_medium:')) tags.add('weather');
  if (k === 'task_overdue_high' || k === 'task_top') tags.add('tasks');
  if (k === 'pattern_worsening' || k === 'scan_followup') tags.add('scan');
  if (k === 'health_urgent') tags.add('farm_health');
  if (k === 'fallback_walk') tags.add('routine');
  return Array.from(tags);
}

// ─── Action-kind → CTA label + route ─────────────────────────
function _ctaFor(action) {
  if (!action) return { ctaLabel: null, ctaRoute: null };
  const k = String(action.kind || '');
  switch (k) {
    case 'health_urgent':      return { ctaLabel: "Open Today's Plan", ctaRoute: '/today' };
    case 'task_overdue_high':
    case 'task_top':           return { ctaLabel: "Open Today's Plan", ctaRoute: '/today' };
    case 'pattern_worsening':
    case 'scan_followup':      return { ctaLabel: 'Rescan',             ctaRoute: '/scan' };
    case 'fallback_walk':      return { ctaLabel: null, ctaRoute: null };
    default:
      // risk_*: lead the farmer to the daily plan where the
      // action would have been queued.
      if (k.startsWith('risk_')) return { ctaLabel: "See today's plan", ctaRoute: '/today' };
      return { ctaLabel: "Open Today's Plan", ctaRoute: '/today' };
  }
}

// ─── 'Noticed' phrase ─────────────────────────────────────────
// Short observational phrase the user reads first. We re-purpose
// the engine's title for risk / pattern / scan signals (those
// titles ARE short noticed-phrases). For health-urgent and
// task-overdue, we synthesise a calm noticed-line.
function _noticedFor(action) {
  if (!action) return null;
  const k = String(action.kind || '');
  if (k === 'health_urgent')      return 'Several signs need care today.';
  if (k === 'task_overdue_high')  return 'A high-priority task is overdue.';
  if (k === 'task_top')           return action.title || 'A task is at the top of your list.';
  if (k === 'fallback_walk')      return 'No urgent signals.';
  // risk_*, pattern_*, scan_*: the engine title is already a
  // calm one-line phrasing.
  return action.title || null;
}

// ─── 'Meaning' line ───────────────────────────────────────────
// Plain-language explanation. Pulled from the engine's reason
// field — which the existing engine already composes from
// real signals (no fabrication).
function _meaningFor(action) {
  if (!action) return null;
  return action.reason || null;
}

// ─── 'Action' line ────────────────────────────────────────────
// What to do TODAY. We prefer the engine's `hint` (it's the
// short imperative phrasing) and fall back to the action title
// when no hint exists.
function _actionFor(action) {
  if (!action) return null;
  return action.hint || action.title || null;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Normalize an engine result OR a full snapshot into the
 * production-trust spec's 9-field shape.
 *
 * Accepts either:
 *   • the raw engine return (computeNextBestAction(...))
 *   • the full snapshot object (uses snapshot.nextBestAction)
 *
 * @param {object} input
 * @returns {{
 *   noticed: string|null,
 *   meaning: string|null,
 *   action:  string|null,
 *   bestTime: string|null,
 *   estimatedMinutes: number|null,
 *   confidenceTone: string|null,
 *   sourceContext: string[],
 *   ctaLabel: string|null,
 *   ctaRoute: string|null,
 * }|null}
 */
export function normalizeNextBestAction(input) {
  if (!input || typeof input !== 'object') return null;

  // Accept the snapshot shape (.nextBestAction) OR the engine
  // return shape directly. We discriminate on the presence of
  // a 'kind' field — engine returns always carry one.
  const action = (typeof input.kind === 'string')
    ? input
    : (input.nextBestAction && typeof input.nextBestAction === 'object')
      ? input.nextBestAction
      : null;

  if (!action) return null;

  const actionType = String(action.actionType || '').toLowerCase();
  const minutes = _EFFORT_MINUTES[actionType] != null
    ? _EFFORT_MINUTES[actionType]
    : null;

  const cta = _ctaFor(action);

  return {
    noticed:          _noticedFor(action),
    meaning:          _meaningFor(action),
    action:           _actionFor(action),
    bestTime:         _bestTimeFor(action),
    estimatedMinutes: minutes,
    confidenceTone:   _confidenceTone(action),
    sourceContext:    _sourceContextFor(action),
    ctaLabel:         cta.ctaLabel,
    ctaRoute:         cta.ctaRoute,
  };
}

export default { normalizeNextBestAction };
