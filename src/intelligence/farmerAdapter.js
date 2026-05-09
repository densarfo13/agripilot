/**
 * farmerAdapter.js — toFarmerGuidance.
 *
 * The single calm conduit through which EVERY intelligence output
 * (rankFarmIntelligence / orchestrator / risk engine / satellite /
 * scoring / AI adapter) becomes farmer-facing copy.
 *
 *   import { toFarmerGuidance } from '../intelligence/farmerAdapter.js';
 *
 *   const guidance = toFarmerGuidance(intelligenceOutput);
 *   //   guidance.title         — short, calm headline (no jargon)
 *   //   guidance.message       — one-line reason in plain words
 *   //   guidance.actionLabel   — verb-first CTA ('Start check')
 *   //   guidance.actionRoute   — '/scan' | '/tasks' | etc.
 *   //   guidance.timeEstimate  — '2 min' | null
 *   //   guidance.tone          — 'calm' | 'attentive' | 'reassuring'
 *
 * SAFETY GUARDRAILS (May 2026 invisible-intelligence spec §12):
 *   • Never returns raw scores, percentages, NDVI numbers, fraud
 *     scores, exact pesticide dosages, yield guarantees, or AI
 *     stack traces. The adapter strips/replaces those fields
 *     before they cross the farmer-facing boundary.
 *   • Risk wording stays calm: 'high' → "needs a quick check",
 *     never "DANGER" / "URGENT" / "CRITICAL".
 *   • Confidence tiers map to natural language: 'low' →
 *     "may want to review", 'medium' → no qualifier, 'high' →
 *     "recommended for your region".
 *   • All output keys point at i18n message keys with safe English
 *     fallbacks so the farmer always sees readable text even if a
 *     locale is mid-flight.
 *
 * STRICT-RULE AUDIT
 *   • Pure. Never throws. Bad input → frozen empty-guidance fallback.
 *   • No translation work happens here — that's the host's job via
 *     `tSafe(key, fallback)`. The adapter only emits the safe shape.
 *   • Idempotent — passing the adapter's own output back through
 *     yields the same envelope.
 */

const VALID_TONES = Object.freeze(['calm', 'attentive', 'reassuring']);

// Words the farmer-facing adapter will NEVER emit. Risk language
// must stay calm; we map fear words to neutral wording.
const FORBIDDEN_RISK_WORDS = Object.freeze([
  'danger', 'urgent', 'critical', 'severe', 'fatal', 'fraud',
  'guaranteed', '100%',
]);

// Internal-only fields the adapter strips before returning.
// Anything in this list is guaranteed not to appear in the
// farmer-facing envelope.
const INTERNAL_FIELDS = Object.freeze([
  'sourceSignals', 'rawScore', 'rawConfidence', 'ndvi', 'fraudScore',
  'trustScore', 'riskPercent', 'modelVersion', 'modelOutput',
  'aiPrompt', 'aiResponse', 'pesticideDosage', 'chemicalDose',
  'yieldEstimate', 'yieldKg', 'probability',
]);

const DEFAULT_FALLBACK = Object.freeze({
  title:        'home.guidance.calmCheck',
  titleFb:      'Good day for a quick check',
  message:      'home.guidance.calmCheckMessage',
  messageFb:    'Inspect leaves and soil moisture when convenient.',
  actionLabel:  'actions.startCheck',
  actionLabelFb:'Start check',
  actionRoute:  '/scan',
  timeEstimate: '2 min',
  tone:         'calm',
});

/**
 * toFarmerGuidance(input) — convert any intelligence output into
 * the calm farmer-facing envelope.
 *
 * Accepts:
 *   • orchestrator output ({ titleKey, messageKey, actionLabelKey,
 *     actionRoute, estimatedMinutes, ... })
 *   • rankFarmIntelligence().primary task ({ titleKey, route, ... })
 *   • risk engine output ({ level, signals, recommendedAction })
 *   • plain { title, message, action, ... } shorthand
 *   • null / undefined / bad shapes → safe fallback
 */
export function toFarmerGuidance(input) {
  if (!input || typeof input !== 'object') return _frozen(DEFAULT_FALLBACK);

  try {
    // Strip all internal fields before further processing.
    const safe = _stripInternal(input);

    const title         = _str(safe.title || safe.titleKey || safe.titleFb)
                       || DEFAULT_FALLBACK.title;
    const titleFb       = _str(safe.titleFb || safe.title)
                       || DEFAULT_FALLBACK.titleFb;
    const message       = _str(safe.message || safe.messageKey || safe.reasonKey)
                       || DEFAULT_FALLBACK.message;
    const messageFb     = _str(safe.messageFb || safe.message || safe.reasonFb)
                       || DEFAULT_FALLBACK.messageFb;
    const actionLabel   = _str(safe.actionLabel || safe.actionLabelKey
                                 || safe.ctaKey  || safe.cta)
                       || DEFAULT_FALLBACK.actionLabel;
    const actionLabelFb = _str(safe.actionLabelFb || safe.ctaFallback
                                 || safe.actionLabel)
                       || DEFAULT_FALLBACK.actionLabelFb;
    const actionRoute   = _route(safe.actionRoute || safe.route)
                       || DEFAULT_FALLBACK.actionRoute;
    const timeEstimate  = _timeEstimate(
      safe.timeEstimate ?? safe.estimatedMinutes ?? safe.minutes
    );
    const tone          = _tone(safe.tone, safe.urgency || safe.level);

    // Defence-in-depth — sanitise every emitted string against the
    // forbidden-risk-word list. If any leaks through, we fall back
    // to the calm message rather than echo it.
    const titleSafe       = _sanitise(titleFb);
    const messageSafe     = _sanitise(messageFb);
    const actionLabelSafe = _sanitise(actionLabelFb);

    return _frozen({
      title:         title,
      titleFb:       titleSafe,
      message:       message,
      messageFb:     messageSafe,
      actionLabel:   actionLabel,
      actionLabelFb: actionLabelSafe,
      actionRoute:   actionRoute,
      timeEstimate:  timeEstimate,
      tone:          tone,
    });
  } catch {
    return _frozen(DEFAULT_FALLBACK);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function _frozen(o) { return Object.freeze({ ...o }); }

function _str(v) {
  return (typeof v === 'string' && v.trim()) ? v.trim() : '';
}

function _route(v) {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  // Internal app routes only — never an outbound URL.
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  return '';
}

function _timeEstimate(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t || null;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  const minutes = Math.round(n);
  return `${minutes} min`;
}

function _tone(explicit, hint) {
  if (typeof explicit === 'string' && VALID_TONES.includes(explicit)) {
    return explicit;
  }
  // Map upstream urgency / risk-level to a tone band:
  //   'high' / 'urgent'   → 'attentive' (still calm, no fear)
  //   'low'  / 'reassure' → 'reassuring'
  //   else                → 'calm'
  const h = String(hint || '').toLowerCase();
  if (h === 'high' || h === 'urgent' || h === 'attention') return 'attentive';
  if (h === 'reassure' || h === 'reassuring' || h === 'low') return 'reassuring';
  return 'calm';
}

function _stripInternal(input) {
  const out = {};
  for (const k of Object.keys(input)) {
    if (INTERNAL_FIELDS.includes(k)) continue;
    out[k] = input[k];
  }
  return out;
}

function _sanitise(text) {
  const lc = String(text).toLowerCase();
  for (const w of FORBIDDEN_RISK_WORDS) {
    if (lc.includes(w)) return DEFAULT_FALLBACK.titleFb;
  }
  return text;
}

export const _internal = Object.freeze({
  DEFAULT_FALLBACK,
  FORBIDDEN_RISK_WORDS,
  INTERNAL_FIELDS,
  VALID_TONES,
});

export default toFarmerGuidance;
