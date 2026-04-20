/**
 * devAssertions.js — centralized development-only warnings for
 * the wiring rules in the fast-onboarding integration spec.
 *
 * Every assertion:
 *   • is a pure function (input → void; no throwing)
 *   • is a no-op in production
 *   • logs a structured console.warn under a stable tag
 *   • uses a named reason so tests can assert on it
 *
 * Consumers call these where the rule should hold. The goal is
 * NOT to block render — it's to make regressions loud in dev.
 */

import {
  warnFirstTimeRoutingRegression,
  FIRST_TIME_WARN,
} from './firstTimeFarmerGuard.js';

function isDev() {
  if (typeof window === 'undefined') return false;
  const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV)
    || 'development';
  return env !== 'production';
}

/** §19: more than one dominant Home card */
export function assertSingleDominantCard(cardCount, details = {}) {
  if (!isDev()) return;
  if (typeof cardCount !== 'number' || cardCount <= 1) return;
  warnFirstTimeRoutingRegression(
    'more than one dominant Home card',
    { ...details, cardCount, rule: 'home.dominant_card_singleton' },
  );
}

/** §19: Home rendered without a why line */
export function assertHomeHasWhy(payload, details = {}) {
  if (!isDev()) return;
  if (!payload || typeof payload !== 'object') return;
  const why = payload.why || payload.whyLine || payload.reason;
  if (why && String(why).trim().length > 0) return;
  warnFirstTimeRoutingRegression(
    'Home rendered without why line',
    { ...details, rule: 'home.why_required' },
  );
}

/** §19: null countryCode when country is required (e.g. continue) */
export function assertCountryPresent(countryCode, details = {}) {
  if (!isDev()) return;
  if (countryCode && String(countryCode).trim().length > 0) return;
  warnFirstTimeRoutingRegression(
    'continue allowed with null countryCode when country required',
    { ...details, rule: 'setup.country_required_on_continue' },
  );
}

/** §19: low confidence + no conflict, but wording forces check-first */
export function assertCheckFirstHasReason(usingCheckFirst, conflictReason, details = {}) {
  if (!isDev()) return;
  if (!usingCheckFirst) return;
  if (conflictReason && String(conflictReason).trim().length > 0) return;
  warnFirstTimeRoutingRegression(
    'low confidence + no conflict still using check-first',
    { ...details, rule: 'confidence.check_first_requires_reason' },
  );
}

/** §19: stale/very-stale state using direct certainty wording */
export function assertNotDirectOnStale(freshness, tone, details = {}) {
  if (!isDev()) return;
  if (!freshness) return;
  const stale = freshness === 'stale' || freshness === 'very_stale';
  if (!stale) return;
  if (tone !== 'direct' && tone !== 'certain') return;
  warnFirstTimeRoutingRegression(
    'stale/very stale state using direct certainty',
    { ...details, freshness, tone, rule: 'freshness.soften_on_stale' },
  );
}

/** §19: auto-detect committed without confirmation step */
export function assertLocationConfirmed(locationSource, wasConfirmed, details = {}) {
  if (!isDev()) return;
  if (locationSource !== 'detect') return;
  if (wasConfirmed === true) return;
  warnFirstTimeRoutingRegression(
    'auto-detect committed without confirmation',
    { ...details, locationSource, rule: 'setup.location_requires_confirm' },
  );
}

/** §19: greeting/header bypassing the state engine */
export function assertHeaderFromStateEngine(headerSource, details = {}) {
  if (!isDev()) return;
  if (headerSource === 'state_engine') return;
  warnFirstTimeRoutingRegression(
    'greeting/header bypassing state engine',
    { ...details, headerSource, rule: 'home.header_from_state_engine' },
  );
}

/** §19: old and new onboarding routes both active at the same time */
export function assertNotBothOnboardingRoutes(newActive, legacyActive, details = {}) {
  if (!isDev()) return;
  if (!(newActive && legacyActive)) return;
  warnFirstTimeRoutingRegression(
    'old and new onboarding routes both active',
    { ...details, rule: 'routing.onboarding_path_singleton' },
  );
}

/** §19: setup screen still showing hardcoded English in Hindi mode */
export function assertNoEnglishLeakInHindi(locale, visibleText, details = {}) {
  if (!isDev()) return;
  if (locale !== 'hi') return;
  if (!visibleText || typeof visibleText !== 'string') return;
  // Cheap heuristic: if the visible text contains only ASCII letters
  // (no Devanagari) and is longer than 3 chars, it's almost certainly
  // an untranslated English string.
  const hasDevanagari = /[\u0900-\u097F]/.test(visibleText);
  const mostlyAscii   = /^[\x00-\x7F]+$/.test(visibleText);
  if (!hasDevanagari && mostlyAscii && visibleText.trim().length > 3) {
    warnFirstTimeRoutingRegression(
      'setup still showing hardcoded English in Hindi mode',
      { ...details, sample: visibleText.slice(0, 40), rule: 'i18n.no_english_leak_in_hi' },
    );
  }
}

/** Re-export named reasons for ergonomic imports. */
export { FIRST_TIME_WARN };
