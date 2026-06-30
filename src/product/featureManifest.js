/**
 * featureManifest.js — the Feature Governor's contract. Every NEW feature must declare a manifest
 * with all twelve fields; `check-feature-manifest.mjs` rejects the build if any field is missing or
 * empty (Product OS §FEATURE GOVERNANCE — "if any field missing, reject feature").
 *
 * This forces the product question — "Does this help the farmer make today's next best decision?"
 * — to be answered in writing before code ships, instead of relying on memory.
 *
 * The registry is seeded with REAL shipped features as worked examples (not placeholders); new
 * features append their manifest here (or a colocated one that imports validateFeatureManifest).
 */
export const REQUIRED_FIELDS = Object.freeze([
  'problem',              // the farmer-facing problem solved
  'persona',              // which farmer (smallholder / commercial / gardener / NGO field officer …)
  'value',                // value created for that farmer
  'successMetric',        // how we know it worked (KPI + telemetry source)
  'offlineBehavior',      // what happens with no connection
  'localizationImpact',   // new strings? all 6 locales? clipping risk?
  'accessibilityImpact',  // 48px / contrast / VoiceOver / dynamic type
  'performanceImpact',    // added requests / renders / hot-path cost
  'aiImpact',             // any model/provider call? confidence + evidence + fallback?
  'dataRequired',         // what data it reads/writes; owner + freshness
  'privacyImpact',        // secrets? coords? image bytes? PII?
  'enterpriseImpact',     // tenant isolation / audit / role impact
]);

/** Pure validator. Returns { ok, missing[] }. A field is satisfied iff it's a non-empty string. */
export function validateFeatureManifest(m) {
  const missing = [];
  const obj = (m && typeof m === 'object') ? m : {};
  for (const f of REQUIRED_FIELDS) {
    const v = obj[f];
    if (typeof v !== 'string' || v.trim().length < 3) missing.push(f);
  }
  return Object.freeze({ ok: missing.length === 0, missing: Object.freeze(missing) });
}

/** Registry — real shipped features, each a complete worked example of the contract. */
export const FEATURE_REGISTRY = Object.freeze({
  scanAnalyze: {
    problem: 'A farmer does not know what is wrong with a sick crop.',
    persona: 'Smallholder farmer with a phone camera, low literacy.',
    value: 'An honest diagnosis + one next action, or a clear reason it could not identify.',
    successMetric: 'Confident named identification rate; scan_result_success telemetry.',
    offlineBehavior: 'Falls back to the local rule-based result; never blocks; queues for review.',
    localizationImpact: 'All result + failure strings via i18n; farmer-safe language gate enforced.',
    accessibilityImpact: 'Camera shell uses 48px controls; results are text + label, not color-only.',
    performanceImpact: 'One provider call with AbortController + timeout; retries only transient failures.',
    aiImpact: 'CV providers; confidence normalized + banded; never fabricates a diagnosis; rule fallback.',
    dataRequired: 'Image (not stored), coarse location optional; provider keys are server-side secrets.',
    privacyImpact: 'No image bytes or secrets logged; coarse coords only in traces.',
    enterpriseImpact: 'Provider keys never reach the browser; scan metrics are tenant-scoped.',
  },
  sellDecision: {
    problem: 'A farmer does not know whether to sell now or wait.',
    persona: 'Smallholder farmer with a crop ready to sell.',
    value: 'One honest verdict (SELL_NOW / WAIT / NEED_MORE_PRICE_DATA / NO_BUYERS_FOUND).',
    successMetric: 'Sell-decision shown + acted on; productivity/trust KPI.',
    offlineBehavior: 'Pure function over cached demand + price signals; works offline.',
    localizationImpact: 'Verdict copy via i18n key + fallback; no fabricated numbers.',
    accessibilityImpact: 'Rendered in the market card with legible contrast; text-led.',
    performanceImpact: 'Pure synchronous decision; no network.',
    aiImpact: 'No AI; rule-based on real buyer interest + price reference; never invents a price.',
    dataRequired: 'Buyer-interest count (marketDemand), price-reference presence.',
    privacyImpact: 'None — aggregate signals only.',
    enterpriseImpact: 'None — buyer-facing marketplace is honest/no-money-by-design.',
  },
  locationOnboarding: {
    problem: 'A farmer needs weather-aware guidance but location may be missing or denied.',
    persona: 'New farmer onboarding on a phone with variable GPS.',
    value: 'Never dead-ends: GPS, retry, town/ZIP search, or continue with general guidance.',
    successMetric: 'Location acquisition / general-guidance completion; onboarding funnel.',
    offlineBehavior: 'Manual town/ZIP + general-guidance path work without GPS or network.',
    localizationImpact: 'All states + buttons localized; specific failure reasons, never generic.',
    accessibilityImpact: '48px targets; explicit reasons; no color-only status.',
    performanceImpact: 'Retry-once policy; bounded; auto-continue on success.',
    aiImpact: 'None.',
    dataRequired: 'Coarse coords (rounded ~1km) or town/region; never precise coords stored.',
    privacyImpact: 'Coarse coordinates only; redacted in the location debug trace.',
    enterpriseImpact: 'None.',
  },
});

export default FEATURE_REGISTRY;
