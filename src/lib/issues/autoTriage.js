/**
 * autoTriage.js — rules-based automation for the farmer → admin →
 * field-officer pipeline. Pure + deterministic — no ML, no auto
 * resolution, no critical decisions.
 *
 * What this module does, in order:
 *
 *   1. inferSeverity(text, explicitSeverity?)
 *        keyword-based: urgent / dying / destroyed / everywhere → high;
 *        yellow / spots / mild / few → low; default medium.
 *        An explicit severity from the caller ALWAYS wins.
 *
 *   2. pickOfficer({ issue, registry, activeCountsByOfficer })
 *        scoring: +2 if the officer covers the issue's location
 *                 +2 if they cover the crop
 *                 -1 per active (non-resolved) issue they already have
 *        returns the top-scored officer, or null when either the
 *        registry is empty OR no officer has a positive score.
 *        A null return means "route to admin queue" (status stays
 *        `open`).
 *
 *   3. suggestResponse(issueType)
 *        short farmer-friendly recommendation, marked `suggested: true`
 *        so the UI can label it "Suggested — confirm with officer".
 *
 *   4. autoProcessIssue(issue, { registry, allIssues })
 *        returns the side-effects the store should apply:
 *          { severity, assignTo, suggestedNote, systemNote }
 *        Never mutates its inputs.
 *
 * The store calls these helpers; the helpers never touch
 * localStorage or globals themselves. Tests exercise the helpers in
 * isolation; `issueStore.createIssue({ autoTriage: true })` glues
 * them to the pipeline.
 *
 * Safety contract:
 *   • NEVER auto-resolve, auto-escalate, or auto-delete.
 *   • NEVER decide that a farmer-reported high severity is actually
 *     low — caller's explicit severity always wins.
 *   • Suggested notes are advisory only; they do not change status.
 */

import { ISSUE_SEVERITY, ISSUE_STATUS, __wireAutoTriage } from './issueStore.js';

// ─── Severity heuristics ─────────────────────────────────────────
// Keep these small + human-readable. English only for v1 — we can
// add localised keyword sets later without changing callers.
const HIGH_KEYWORDS = [
  'urgent', 'dying', 'destroyed', 'destroying', 'everywhere',
  'whole farm', 'entire farm', 'all the', 'all of', 'losing',
  'crisis', 'emergency', 'severe', 'killed', 'dead',
];
const LOW_KEYWORDS = [
  'yellow', 'mild', 'small spot', 'a few', 'couple of', 'just one',
  'slight', 'minor', 'first sign', 'early',
];

// Issue types that imply a higher baseline even without keywords.
const TYPE_BASELINE = Object.freeze({
  pest:           ISSUE_SEVERITY.MEDIUM,
  disease:        ISSUE_SEVERITY.MEDIUM,
  weather_damage: ISSUE_SEVERITY.HIGH,
  soil:           ISSUE_SEVERITY.LOW,
  irrigation:     ISSUE_SEVERITY.MEDIUM,
  input_shortage: ISSUE_SEVERITY.LOW,
  access:         ISSUE_SEVERITY.LOW,
  other:          ISSUE_SEVERITY.MEDIUM,
});

function anyIn(haystack, needles) {
  const s = String(haystack || '').toLowerCase();
  for (const n of needles) if (s.includes(n)) return true;
  return false;
}

/**
 * inferSeverity — returns the caller's explicit severity when set,
 * otherwise derives one from the description + type baseline. Never
 * downgrades an explicit high.
 */
export function inferSeverity({ description = '', issueType = 'other', explicit = null } = {}) {
  if (explicit && Object.values(ISSUE_SEVERITY).includes(explicit)) return explicit;
  if (anyIn(description, HIGH_KEYWORDS)) return ISSUE_SEVERITY.HIGH;
  if (anyIn(description, LOW_KEYWORDS))  return ISSUE_SEVERITY.LOW;
  return TYPE_BASELINE[issueType] || ISSUE_SEVERITY.MEDIUM;
}

// ─── Officer picker ──────────────────────────────────────────────
/**
 * Match score for one officer against one issue.
 *   + region match  → +2
 *   + crop match    → +2
 *   − workload      → subtract current in-flight issue count
 *
 * Returns a negative value when the officer covers neither region
 * nor crop, which guarantees `pickOfficer` returns null for an
 * unrelated officer pool (no cross-country drift).
 */
function scoreOfficer(officer, issue, activeCount) {
  let score = -1; // default to a negative floor so "no coverage" ties go to null
  const regions = Array.isArray(officer.regions) ? officer.regions : [];
  const crops   = Array.isArray(officer.crops)   ? officer.crops   : [];
  const locCandidates = [
    issue.stateCode, issue.state, issue.location, issue.countryCode, issue.country,
  ].filter(Boolean).map(String);
  const cropKey = issue.crop ? String(issue.crop).toLowerCase() : null;

  const regionMatch = regions.some((r) => locCandidates.some((l) => l.includes(String(r))));
  const cropMatch   = !!(cropKey && crops.some((c) => String(c).toLowerCase() === cropKey));

  if (regionMatch) score += 3; // +2 plus the +1 to clear the -1 floor
  if (cropMatch)   score += 2;
  score -= Math.max(0, Number(activeCount) || 0);
  return { score, regionMatch, cropMatch };
}

/**
 * pickOfficer — deterministic tie-breaks:
 *   1. highest score wins
 *   2. ties broken by fewer active issues
 *   3. then by earlier position in the registry (stable)
 *
 * Returns the chosen officer or null. Null = "admin queue".
 */
export function pickOfficer({ issue, registry = [], activeCountsByOfficer = {} } = {}) {
  if (!issue || !Array.isArray(registry) || registry.length === 0) return null;
  let best = null;
  let bestScore = 0; // strict > 0 required so "no coverage" stays null
  let bestIdx = -1;
  for (let i = 0; i < registry.length; i += 1) {
    const o = registry[i];
    if (!o || !o.id) continue;
    const active = Number(activeCountsByOfficer[o.id]) || 0;
    const { score } = scoreOfficer(o, issue, active);
    if (score > bestScore
        || (score === bestScore && best && active < (Number(activeCountsByOfficer[best.id]) || 0))) {
      best = o; bestScore = score; bestIdx = i;
    }
  }
  // eslint-disable-next-line no-unused-vars
  return bestIdx >= 0 && bestScore > 0 ? best : null;
}

// ─── Suggested responses ─────────────────────────────────────────
const SUGGESTIONS = Object.freeze({
  pest:           'Inspect affected plants and remove visibly damaged leaves. Keep the rest intact.',
  disease:        'Photograph a few affected leaves for the officer. Avoid handling other plants afterwards.',
  weather_damage: 'Check drainage and stake any bent stems. Do not irrigate until the soil has dried.',
  soil:           'Note the patch size and depth. A soil test will confirm the fix.',
  irrigation:     'Check your irrigation line for blockages or leaks before watering again.',
  input_shortage: 'List what you need and when. The officer can plan a supply run.',
  access:         'Describe what you cannot reach. Officer will coordinate.',
  other:          'Share a clear photo and a short note. Officer will review shortly.',
});

/** A suggested next step for the farmer. Always advisory, never final. */
export function suggestResponse(issueType) {
  return SUGGESTIONS[String(issueType || '').toLowerCase()] || SUGGESTIONS.other;
}

// ─── High-level orchestrator ─────────────────────────────────────
/**
 * autoProcessIssue — pure planner. Given a freshly-created issue
 * and the current world state (registry + all issues), returns the
 * actions the store should apply. No writes here.
 *
 *   severity        → the (possibly-inferred) severity to stamp
 *   assignTo        → officer id or null (null = admin queue)
 *   systemNote      → "Auto-assigned to officer X" or "Routed to admin queue"
 *   suggestedNote   → advisory guidance shown to the farmer
 *   farmerAck       → short confirmation the UI can surface
 */
export function autoProcessIssue(issue, {
  registry = [],
  allIssues = [],
  now = Date.now(),
} = {}) {
  // Safe default — reject missing / malformed input. No side effects.
  if (!issue || typeof issue !== 'object') {
    return {
      severity: ISSUE_SEVERITY.MEDIUM,
      assignTo: null,
      systemNote: null,
      suggestedNote: null,
      farmerAck: null,
    };
  }

  // Severity: respect explicit severity, else infer.
  const severity = inferSeverity({
    description: issue.description,
    issueType:   issue.issueType,
    explicit:    issue.severity,
  });

  // Workload = count of non-resolved issues per officer.
  const activeCounts = {};
  for (const i of allIssues) {
    if (!i || !i.assignedTo) continue;
    if (i.status === ISSUE_STATUS.RESOLVED) continue;
    activeCounts[i.assignedTo] = (activeCounts[i.assignedTo] || 0) + 1;
  }

  const picked = pickOfficer({
    issue,
    registry,
    activeCountsByOfficer: activeCounts,
  });

  const suggestionText = suggestResponse(issue.issueType);
  const suggestedNote = suggestionText ? {
    text: suggestionText,
    suggested: true,
    authorRole: 'system',
    authorId:   null,
    createdAt:  now,
  } : null;

  const systemNote = picked
    ? { text: `Auto-assigned to ${picked.name || picked.id}`, authorRole: 'system', createdAt: now }
    : { text: 'Routed to admin queue — no matching officer', authorRole: 'system', createdAt: now };

  const farmerAck = picked
    ? 'Your issue has been received and assigned.'
    : 'Your issue has been received. Admin is reviewing.';

  return {
    severity,
    assignTo: picked ? picked.id : null,
    systemNote,
    suggestedNote,
    farmerAck,
  };
}

export const _internal = Object.freeze({
  HIGH_KEYWORDS, LOW_KEYWORDS, TYPE_BASELINE, SUGGESTIONS,
  scoreOfficer,
});

// Wire the planner into issueStore so createIssue({ autoTriage: true })
// can invoke it synchronously. Kept outside the circular top-level
// execution by being a function call AFTER the exports settle.
__wireAutoTriage(autoProcessIssue);
