/**
 * trustProfile.js — farmer-level operational trust + completeness
 * profile. Thin layer over `verificationSignals` that adds:
 *
 *   • a 3-tier trust level: 'low' | 'medium' | 'high'
 *   • a visible, ordered checklist of component signals
 *   • a next-best-action list for guiding the farmer to improve
 *     their own data quality
 *
 * This is NOT a fraud score. It is a transparent, rules-based
 * rollup of existing signals so NGOs, funders, and the farmer
 * themselves can see what's captured and what's still missing.
 *
 *   getFarmerTrustProfile({
 *     farm,         // local / server farm record
 *     events,       // farroway.farmEvents slice (optional)
 *     completions,  // legacy completion rows  (optional)
 *     now,          // Date | ms (optional — defaults to now)
 *     activityWindowDays, // defaults to 7
 *   }) → {
 *     level:        'low' | 'medium' | 'high',
 *     score:        0..6,               // how many signals are met
 *     max:          6,
 *     percent:      0..100,             // score / max, rounded
 *     checklist:    ChecklistItem[],    // one per signal, ordered
 *     nextActions:  NextAction[],       // missing signals, ordered
 *     signals:      { …raw booleans + counts },
 *     lastActivityAt: epoch ms | null,
 *   }
 *
 * Pure — no IO, no throws, no globals. Caller feeds whatever
 * slice of data it has; missing inputs are treated as "signal
 * not yet met". Frozen output.
 */

import { getFarmerVerificationSignals } from '../ngo/verificationSignals.js';

// ─── Signal catalogue ─────────────────────────────────────────────
// Order matters — it is the order the checklist + nextActions are
// returned in. This gives the UI a stable, prioritised guidance
// surface without any per-call sort.
//
//   id:         stable code used by analytics + CSV + tests.
//   labelKey:   i18n key for the checklist label.
//   actionKey:  i18n key for the "do this" call-to-action line.
//   weight:     contribution to `score` (kept at 1 for v1 — flat).
//
// Keep this list short + human-readable. Any new rule should
// answer: "is this signal an NGO/funder would actually ask for?"
export const TRUST_SIGNALS = Object.freeze([
  { id: 'onboardingComplete', labelKey: 'trust.signal.onboarding',  actionKey: 'trust.action.onboarding',  weight: 1 },
  { id: 'locationCaptured',   labelKey: 'trust.signal.location',    actionKey: 'trust.action.location',    weight: 1 },
  { id: 'cropSelected',       labelKey: 'trust.signal.crop',        actionKey: 'trust.action.crop',        weight: 1 },
  { id: 'organizationLinked', labelKey: 'trust.signal.organization',actionKey: 'trust.action.organization',weight: 1 },
  { id: 'recentActivity',     labelKey: 'trust.signal.recent',      actionKey: 'trust.action.recent',      weight: 1 },
  { id: 'taskActivity',       labelKey: 'trust.signal.task',        actionKey: 'trust.action.task',        weight: 1 },
]);

export const TRUST_MAX = TRUST_SIGNALS.reduce((s, r) => s + r.weight, 0);

// Fallback English labels — used when the caller doesn't pass a
// translator. Keeps pure-function callers (tests, server, CSV
// header rows) from needing an i18n dependency.
const FALLBACK_LABELS = Object.freeze({
  'trust.signal.onboarding':   'Profile complete',
  'trust.signal.location':     'Location captured',
  'trust.signal.crop':         'Crop selected',
  'trust.signal.organization': 'Linked to organization',
  'trust.signal.recent':       'Active recently',
  'trust.signal.task':         'Task updates recorded',

  'trust.action.onboarding':   'Finish onboarding (name, crop, country)',
  'trust.action.location':     'Add your farm location',
  'trust.action.crop':         'Select your main crop',
  'trust.action.organization': 'Link to an organization or program',
  'trust.action.recent':       'Open Farroway and log today\u2019s activity',
  'trust.action.task':         'Mark one task as done',

  'trust.level.low':    'Basic',
  'trust.level.medium': 'Good',
  'trust.level.high':   'Strong',
});

/** Resolve an i18n key with graceful fallback to English. */
function resolveLabel(t, key) {
  if (typeof t === 'function') {
    const v = t(key);
    if (v && v !== key) return v;
  }
  return FALLBACK_LABELS[key] || key;
}

// ─── Level thresholds (transparent + rules-based) ─────────────────
// 6 signals total → pick thresholds farmers + NGOs would intuit:
//   • 0-2 signals → "Basic"   (low — needs significant setup)
//   • 3-4 signals → "Good"    (medium — engaged but incomplete)
//   • 5-6 signals → "Strong"  (high — complete + active)
//
// These are public + swappable. No hidden weights, no ML.
const LEVEL_THRESHOLDS = Object.freeze({
  low:    { min: 0, max: 2 },
  medium: { min: 3, max: 4 },
  high:   { min: 5, max: 6 },
});

function levelFromScore(score) {
  const s = Number(score) || 0;
  if (s >= LEVEL_THRESHOLDS.high.min)   return 'high';
  if (s >= LEVEL_THRESHOLDS.medium.min) return 'medium';
  return 'low';
}

// ─── Organization-link detection ──────────────────────────────────
// A farm is "linked to an organization" if any of these are true
// on the farm record. We check multiple shapes because different
// call sites (local onboarding, server /farm/me/context, admin
// import) store the link under different keys.
function isOrgLinked(farm) {
  if (!farm || typeof farm !== 'object') return false;
  const candidates = [
    farm.program,
    farm.programId,
    farm.program_id,
    farm.organization,
    farm.organizationId,
    farm.organization_id,
    farm.orgId,
    farm.org_id,
    farm.ngoId,
    farm.ngo_id,
    farm.partnerId,
  ];
  for (const v of candidates) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length > 0 && s !== 'null' && s !== 'undefined') return true;
  }
  return false;
}

/**
 * getFarmerTrustProfile — main entry point.
 *
 * `t` (optional translator) is used only to localise checklist
 * labels + next-action lines. Raw booleans + level + score are
 * always English-agnostic so they're safe to log, export, and
 * aggregate across locales.
 */
export function getFarmerTrustProfile(input = {}, t = null) {
  const {
    farm = null,
    events = [],
    completions = [],
    now = null,
    activityWindowDays = 7,
  } = input;

  // Build the low-level signal set. `verificationSignals` gives us
  // the 5-signal rollup used by NGO analytics — we extend it with
  // `organizationLinked` so the trust profile is self-contained.
  const base = getFarmerVerificationSignals({
    farm, events, completions, now, activityWindowDays,
  });
  const organizationLinked = isOrgLinked(farm);

  const signals = {
    onboardingComplete: !!base.onboardingComplete,
    locationCaptured:   !!base.locationCaptured,
    cropSelected:       !!base.cropSelected,
    organizationLinked,
    recentActivity:     !!base.recentActivity,
    taskActivity:       !!base.taskActivity,
    completedCount:     base.completedCount || 0,
  };

  // Build the checklist + derived score in one pass — keeps the
  // order deterministic and matches TRUST_SIGNALS.
  let score = 0;
  const checklist   = [];
  const nextActions = [];

  for (const rule of TRUST_SIGNALS) {
    const met = !!signals[rule.id];
    if (met) score += rule.weight;

    checklist.push(Object.freeze({
      id:     rule.id,
      met,
      label:  resolveLabel(t, rule.labelKey),
      labelKey: rule.labelKey,
    }));

    if (!met) {
      nextActions.push(Object.freeze({
        id:        rule.id,
        label:     resolveLabel(t, rule.actionKey),
        actionKey: rule.actionKey,
      }));
    }
  }

  const level   = levelFromScore(score);
  const percent = TRUST_MAX > 0 ? Math.round((score / TRUST_MAX) * 100) : 0;

  return Object.freeze({
    level,
    levelLabel:  resolveLabel(t, `trust.level.${level}`),
    score,
    max:         TRUST_MAX,
    percent,
    checklist:   Object.freeze(checklist),
    nextActions: Object.freeze(nextActions),
    signals:     Object.freeze(signals),
    lastActivityAt: base.lastActivityAt || null,
  });
}

/**
 * trustLevelFromScore — exposed so the CSV/report layer can map
 * a stored score back to a level without rebuilding the whole
 * profile (e.g. when reading rows written by an older writer).
 */
export function trustLevelFromScore(score) {
  return levelFromScore(score);
}

export const _internal = Object.freeze({
  LEVEL_THRESHOLDS,
  FALLBACK_LABELS,
  isOrgLinked,
  levelFromScore,
});
