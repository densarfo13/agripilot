/**
 * aiAdapter.ts — server-side AI adapter (May 2026 invisible-
 * intelligence spec §4).
 *
 * Single entry-point for any intelligence layer that may want to
 * defer to an LLM for wording polish / classification / summary.
 * The adapter NEVER calls an LLM directly without the rule-based
 * fallback ready, and NEVER lets raw model output cross the
 * farmer-facing boundary.
 *
 * Contract
 * ────────
 *   When OPENAI_API_KEY is present AND the ENABLE_AI_ADAPTER flag
 *   is on, the adapter MAY (in a future turn) hit OpenAI to enrich
 *   the supplied intelligence envelope. Until then, the adapter is
 *   wired and gated; callers get the rule-based result back today
 *   with `{ source: 'rule_based' }` so they can log the path.
 *
 * Hard guardrails — NEVER:
 *   • prescribe a chemical / pesticide dosage
 *   • guarantee a diagnosis
 *   • guarantee yield numbers
 *   • generate funding / external links (use the verified whitelist)
 *   • return raw model output (always passes through the
 *     server-side equivalent of toFarmerGuidance before emit)
 *
 * Strict-rule audit
 *   • Pure-when-disabled: identical input always returns the same
 *     `{ source: 'rule_based', guidance }` envelope.
 *   • Never throws — every failure path collapses to rule-based.
 *   • Reads env at CALL TIME so runtime toggles are honoured by
 *     downstream services (cron jobs, queue workers).
 */

export interface IntelligenceContext {
  weather?: unknown;
  cropName?: string;
  cropStage?: string;
  region?: string;
  country?: string;
  recentScan?: unknown;
  taskHistory?: unknown[];
  // Catch-all for additional internal signals — never forwarded
  // to the LLM verbatim. The adapter selects an allowlist of
  // sanitised fields before any external call.
  [k: string]: unknown;
}

export interface FarmerGuidance {
  title: string;
  titleFb: string;
  message: string;
  messageFb: string;
  actionLabel: string;
  actionLabelFb: string;
  actionRoute: string;
  timeEstimate: string | null;
  tone: 'calm' | 'attentive' | 'reassuring';
}

export interface AdapterResult {
  source: 'ai' | 'rule_based';
  guidance: FarmerGuidance;
  reason: string;
}

const DEFAULT_GUIDANCE: FarmerGuidance = Object.freeze({
  title:         'home.guidance.calmCheck',
  titleFb:       'Good day for a quick check',
  message:       'home.guidance.calmCheckMessage',
  messageFb:     'Inspect leaves and soil moisture when convenient.',
  actionLabel:   'actions.startCheck',
  actionLabelFb: 'Start check',
  actionRoute:   '/scan',
  timeEstimate:  '2 min',
  tone:          'calm',
});

const TRUTHY_ENV = new Set(['1', 'true', 'on', 'yes', 'enabled']);

function _hasOpenAIKey(): boolean {
  try {
    const v = process.env.OPENAI_API_KEY;
    return typeof v === 'string' && v.trim().length > 0;
  } catch { return false; }
}

function _flagEnabled(): boolean {
  try {
    const v = (process.env.ENABLE_AI_ADAPTER || '').trim().toLowerCase();
    return TRUTHY_ENV.has(v);
  } catch { return false; }
}

/**
 * isAIAdapterAvailable — true ONLY when both:
 *   • OPENAI_API_KEY is set, AND
 *   • ENABLE_AI_ADAPTER=1 is configured.
 *
 * Either one missing → adapter falls back to rule-based.
 */
export function isAIAdapterAvailable(): boolean {
  return _hasOpenAIKey() && _flagEnabled();
}

/**
 * aiAdapter.enrich(input) → adapter result.
 *
 * Today: ALWAYS returns the rule-based path (the network call to
 * OpenAI is intentionally NOT wired in this turn — adding a live
 * external dependency without a paired cost / abuse review is
 * out of scope for the foundations pass).
 *
 * The adapter still reports the right `source` so downstream
 * telemetry can distinguish "AI was eligible" (key present + flag
 * on) from "AI not eligible". When the live wiring lands, swap
 * the rule-based body for the LLM call WITHOUT changing the
 * external signature — every consumer is already calm-only.
 */
export async function enrichGuidance(
  ctx: IntelligenceContext,
  baseGuidance: FarmerGuidance | null = null,
): Promise<AdapterResult> {
  const guidance = _mergeGuidance(DEFAULT_GUIDANCE, baseGuidance);

  if (!isAIAdapterAvailable()) {
    return Object.freeze({
      source: 'rule_based',
      guidance,
      reason: _hasOpenAIKey() ? 'flag_disabled' : 'no_api_key',
    });
  }

  // Eligible path — until the LLM call is wired we still emit
  // rule_based so downstream telemetry never mis-claims "AI ran".
  // The signature is stable; the future wiring swaps the body
  // here only.
  return Object.freeze({
    source: 'rule_based',
    guidance,
    reason: 'eligible_but_unwired',
  });
}

/**
 * classifySupportNeed(text) → coarse category string.
 *
 * Used by the support intake to route a request without asking
 * the farmer to pick a category. Falls back to 'general' when
 * the AI adapter is unavailable; the support team still sees
 * the raw text.
 */
export async function classifySupportNeed(
  text: string,
): Promise<'general' | 'crop_health' | 'pest' | 'soil' | 'finance' | 'access'> {
  const t = String(text || '').toLowerCase();

  // Rule-based keyword heuristics — work without any AI key.
  if (/leaf|spot|wilt|disease|pest|insect|bug|aphid/.test(t)) return 'crop_health';
  if (/soil|water|drain|moisture|drought/.test(t))           return 'soil';
  if (/loan|grant|funding|money|cost|sell|buyer/.test(t))    return 'finance';
  if (/login|account|password|sign/.test(t))                 return 'access';
  return 'general';
}

// ─── Helpers ─────────────────────────────────────────────────────

function _mergeGuidance(
  base: FarmerGuidance,
  overlay: FarmerGuidance | null,
): FarmerGuidance {
  if (!overlay || typeof overlay !== 'object') return base;
  return Object.freeze({
    title:         overlay.title         || base.title,
    titleFb:       overlay.titleFb       || base.titleFb,
    message:       overlay.message       || base.message,
    messageFb:     overlay.messageFb     || base.messageFb,
    actionLabel:   overlay.actionLabel   || base.actionLabel,
    actionLabelFb: overlay.actionLabelFb || base.actionLabelFb,
    actionRoute:   overlay.actionRoute   || base.actionRoute,
    timeEstimate:  overlay.timeEstimate ?? base.timeEstimate,
    tone:          overlay.tone          || base.tone,
  });
}

export const _internal = Object.freeze({
  DEFAULT_GUIDANCE,
});
