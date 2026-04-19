/**
 * actionabilityService.js — turns detected friction, trust, and
 * hesitation into concrete UI recovery actions. This is the
 * "what do we DO about it" layer sitting above journeyHealthService.
 *
 * Every action is a rule-based match on the JourneyHealthSnapshot
 * plus raw signal inputs. The registry is declarative so new
 * actions can be added without touching the matcher.
 *
 * ActionabilityPlan shape:
 *   {
 *     contextKey: string | null,
 *     actionType: 'ui_recovery' | 'wording_change' | 'catch_up_task'
 *               | 'listing_nudge' | 'explanation_card' | 'confidence_downgrade',
 *     actionKey:  string,   // stable machine identifier
 *     reason:     string,   // human-readable justification
 *     appliesTo:  'onboarding' | 'recommendation' | 'today' | 'listing',
 *     priority:   'low' | 'medium' | 'high',
 *     payload?:   object,   // per-action extra data (fields to show, etc.)
 *   }
 */

import { TRUST_BREAK_PATTERNS } from '../analytics/trustBreakDetector.js';

// ─── Rule registry ────────────────────────────────────────
// Each rule has:
//   • actionKey, actionType, appliesTo, priority (static)
//   • triggers(ctx) → { hit: boolean, reason: string, payload? }
// Rules are evaluated top-down; the first matching rule per
// `appliesTo` surface wins unless `multi: true`.
const RULES = [
  // ─── ONBOARDING — location trust ──────────────────────
  {
    actionKey: 'show_manual_location_shortcut',
    actionType: 'ui_recovery',
    appliesTo: 'onboarding',
    priority: 'high',
    triggers: (ctx) => {
      const retries = countReason(ctx, 'multi_retry');
      const denied  = hasDriver(ctx, TRUST_BREAK_PATTERNS.PERMISSION_DENIED_EXIT);
      if (retries >= 1 || denied) {
        return { hit: true, reason: 'Repeated location retries or permission denied' };
      }
      return { hit: false };
    },
  },
  {
    actionKey: 'soften_location_copy',
    actionType: 'wording_change',
    appliesTo: 'onboarding',
    priority: 'medium',
    triggers: (ctx) => {
      if (ctx.locationConfidence?.level === 'low') {
        return { hit: true, reason: 'Low-confidence location — soften copy', payload: { tier: 'low' } };
      }
      return { hit: false };
    },
  },

  // ─── RECOMMENDATION — trust recovery ──────────────────
  {
    actionKey: 'downgrade_recommendation_confidence_wording',
    actionType: 'confidence_downgrade',
    appliesTo: 'recommendation',
    priority: 'high',
    triggers: (ctx) => {
      if (hasDriver(ctx, TRUST_BREAK_PATTERNS.HIGH_CONF_REC_REJECTED)) {
        return {
          hit: true,
          reason: 'High-confidence recommendation was rejected — downgrade wording next run',
          payload: { targetTier: 'medium' },
        };
      }
      return { hit: false };
    },
  },
  // Order matters — the MORE SEVERE recovery (manual crop search) must
  // match BEFORE the softer reason-cards rule so very-low-trust users
  // get the stronger escape hatch rather than just an explanation card.
  {
    actionKey: 'offer_manual_crop_search',
    actionType: 'ui_recovery',
    appliesTo: 'recommendation',
    priority: 'medium',
    triggers: (ctx) => {
      if (ctx.journey?.trustScore != null && ctx.journey.trustScore < 0.35) {
        return {
          hit: true,
          reason: 'Recommendation trust very low — offer manual crop search path',
        };
      }
      return { hit: false };
    },
  },
  {
    actionKey: 'show_recommendation_reasons',
    actionType: 'explanation_card',
    appliesTo: 'recommendation',
    priority: 'medium',
    triggers: (ctx) => {
      const t = ctx.journey?.trustScore;
      // Explanation cards are the moderate response: trust dented but
      // not broken. Very-low trust is handled by the rule above.
      if (t != null && t < 0.55 && t >= 0.35) {
        return {
          hit: true,
          reason: 'Low trust in recommendations — expose why we suggested these',
        };
      }
      return { hit: false };
    },
  },

  // ─── TODAY — repeated skips / low engagement ──────────
  {
    actionKey: 'add_catch_up_task',
    actionType: 'catch_up_task',
    appliesTo: 'today',
    priority: 'high',
    triggers: (ctx) => {
      const repeatSkipDriver = hasDriver(ctx, 'task_repeat_skip') || countReason(ctx, 'repeat_skip') > 0;
      if (repeatSkipDriver) {
        return {
          hit: true,
          reason: 'User skipped the same task twice — add lightweight catch-up task',
          payload: { escalation: 'soft' },
        };
      }
      return { hit: false };
    },
  },
  {
    actionKey: 'simplify_task_wording',
    actionType: 'wording_change',
    appliesTo: 'today',
    priority: 'medium',
    triggers: (ctx) => {
      if (ctx.taskConfidence?.level === 'low') {
        return {
          hit: true,
          reason: 'Low-confidence task — switch to "check first" variant',
          payload: { tier: 'low' },
        };
      }
      return { hit: false };
    },
  },
  {
    actionKey: 'escalate_urgency_after_repeat',
    actionType: 'ui_recovery',
    appliesTo: 'today',
    priority: 'high',
    triggers: (ctx) => {
      if (countReason(ctx, 'repeat_skip') >= 2) {
        return {
          hit: true,
          reason: 'Multiple repeat-skipped tasks — escalate urgency cue',
        };
      }
      return { hit: false };
    },
  },

  // ─── LISTING — seller conversion ──────────────────────
  {
    actionKey: 'prompt_listing_completeness',
    actionType: 'listing_nudge',
    appliesTo: 'listing',
    priority: 'high',
    triggers: (ctx) => {
      const missing = (ctx.listing || {}).missingFields || [];
      if (missing.length >= 2) {
        return {
          hit: true,
          reason: 'Listing is missing core fields — buyers skip incomplete listings',
          payload: { fields: missing },
        };
      }
      return { hit: false };
    },
  },
  {
    actionKey: 'mark_listing_as_aging',
    actionType: 'wording_change',
    appliesTo: 'listing',
    priority: 'medium',
    triggers: (ctx) => {
      if (ctx.listingConfidence?.level === 'low') {
        return {
          hit: true,
          reason: 'Listing confidence low — show "may be out of date" badge',
          payload: { tier: 'low' },
        };
      }
      return { hit: false };
    },
  },

  // ─── STABILITY RAIL ───────────────────────────────────
  // Default safety catch: if everything looks calm, no action.
  // Put last so it only matches when nothing else did. Returning
  // `{ hit: false }` is the right behavior here — no plan at all.
];

// ─── Public API ───────────────────────────────────────────

/**
 * resolveFrictionAction — surface-specific matcher. Returns
 * the first matching rule for the requested surface, or null.
 *
 *   resolveFrictionAction(ctx, 'today')
 */
export function resolveFrictionAction(ctx, surface) {
  if (!ctx || !surface) return null;
  for (const rule of RULES) {
    if (rule.appliesTo !== surface) continue;
    const r = safeTrigger(rule, ctx);
    if (r?.hit) return toPlan(rule, r, ctx);
  }
  return null;
}

export function resolveTrustRecoveryAction(ctx) {
  // Trust recovery can live on any surface — we scan the whole
  // registry but prefer recommendation+onboarding surfaces first.
  const order = ['recommendation', 'onboarding', 'today', 'listing'];
  for (const surface of order) {
    for (const rule of RULES) {
      if (rule.appliesTo !== surface) continue;
      if (rule.actionType !== 'confidence_downgrade'
          && rule.actionType !== 'explanation_card'
          && rule.actionType !== 'ui_recovery'
          && rule.actionType !== 'wording_change') continue;
      const r = safeTrigger(rule, ctx);
      if (r?.hit && (r.reason || '').toLowerCase().includes('trust')
          || r?.hit && (rule.actionKey || '').includes('reason')) {
        return toPlan(rule, r, ctx);
      }
    }
  }
  return null;
}

export function resolveRecommendationRecoveryAction(ctx) {
  return resolveFrictionAction(ctx, 'recommendation');
}

/**
 * buildActionabilityPlan — run every rule and return the
 * highest-priority match per surface. Output is a
 * `{ onboarding, recommendation, today, listing }` map where
 * values are ActionabilityPlan | null.
 */
export function buildActionabilityPlan(ctx, opts = {}) {
  const out = { onboarding: null, recommendation: null, today: null, listing: null };
  for (const surface of Object.keys(out)) {
    out[surface] = resolveFrictionAction(ctx, surface);
  }
  if (opts.flat) {
    return Object.values(out).filter(Boolean);
  }
  return {
    contextKey: ctx.contextKey || null,
    surfaces:   out,
    hasAnyAction: Object.values(out).some(Boolean),
    highestPriority: highestPriority(Object.values(out).filter(Boolean)),
    createdAt: Date.now(),
  };
}

/**
 * listActionabilityRules — exposes the registry for debug views
 * and testing. Frozen rows so callers can't mutate them.
 */
export function listActionabilityRules() {
  return RULES.map((r) => Object.freeze({
    actionKey: r.actionKey,
    actionType: r.actionType,
    appliesTo: r.appliesTo,
    priority: r.priority,
  }));
}

// ─── internals ────────────────────────────────────────────
function safeTrigger(rule, ctx) {
  try { return rule.triggers(ctx) || { hit: false }; }
  catch { return { hit: false }; }
}

function toPlan(rule, triggerResult, ctx) {
  return {
    contextKey: ctx.contextKey || null,
    actionType: rule.actionType,
    actionKey:  rule.actionKey,
    reason:     triggerResult.reason || rule.actionKey,
    appliesTo:  rule.appliesTo,
    priority:   rule.priority,
    payload:    triggerResult.payload || null,
  };
}

function countReason(ctx, kind) {
  const reasons = ctx?.journey?.sources?.hesitation?.reasons || [];
  return reasons.filter((r) => r?.kind === kind).length;
}

function hasDriver(ctx, name) {
  const fd = ctx?.journey?.topDrivers || [];
  if (fd.includes(name)) return true;
  const friction = ctx?.journey?.sources?.friction || null;
  // (JourneyHealthSnapshot.friction is the raw hesitation info; trust drivers are elsewhere.)
  // Fall back to scanning trustBreaks patterns.
  const tb = ctx?.journey?.sources?.trust;
  if (tb?.patterns?.[name] > 0) return true;
  return false;
}

function highestPriority(plans) {
  const rank = { low: 0, medium: 1, high: 2 };
  return plans.reduce((m, p) => (rank[p.priority] > rank[m || 'low'] ? p.priority : m), null);
}

export const _internal = { RULES };
