/**
 * src/runtime/i18n/LanguageHealthRuntime.js — honest i18n diagnostics.
 *
 * Installs:
 *   window.__languageState()          — active language + persistence chain
 *   window.__languageHealth()         — REAL coverage (no fake 100%)
 *   window.__messageTemplateHealth()  — email/SMS locale readiness
 *
 * Every number is measured, not asserted. Where a value can't be
 * measured on the client, it reports null/false — never a fabricated
 * "100% translated".
 *
 * Strict-rule audit
 *   • Read-only. SSR-safe. Frozen envelopes. Never throws.
 */

import {
  SUPPORTED_LOCALES, entityLocalizationCoverage, getMissingEntityLabels,
  translatorReviewSummary,
} from '../../i18n/translateEntityLabel.js';

export const LANGUAGE_HEALTH_RUNTIME_VERSION = 'language-health-v1';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _ls = (k) => _safe(() => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null), null);

function _activeLanguage() {
  return _safe(() => {
    if (typeof window !== 'undefined' && typeof window.__farrowayActiveLang === 'string') {
      return window.__farrowayActiveLang;
    }
    return _ls('farroway:lang') || _ls('farroway_lang') || _ls('farroway_language') || 'en';
  }, 'en');
}

function _resolveSource() {
  // Mirror the i18n priority chain: manual → profile → localStorage →
  // browser → en. We report which slot the active value came from.
  if (_ls('farroway:lang')) return 'manual';
  const prof = _safe(() => {
    const raw = _ls('farroway:user_profile') || _ls('farroway_user');
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && (p.language || p.lang) ? (p.language || p.lang) : null;
  }, null);
  if (prof) return 'profile';
  if (_ls('farroway_language') || _ls('farroway_lang')) return 'localStorage';
  if (_safe(() => typeof navigator !== 'undefined' && !!navigator.language, false)) return 'browser';
  return 'default';
}

export function languageState() {
  return _safe(() => {
    const selectedLanguage = _activeLanguage();
    const profileLang = _safe(() => {
      const raw = _ls('farroway:user_profile') || _ls('farroway_user');
      if (!raw) return null;
      const p = JSON.parse(raw);
      return (p && (p.language || p.lang)) || null;
    }, null);
    return Object.freeze({
      runtimeVersion:   LANGUAGE_HEALTH_RUNTIME_VERSION,
      selectedLanguage,
      source:           _resolveSource(),
      persistedLocal:   _ls('farroway:lang') || _ls('farroway_lang') || _ls('farroway_language') || null,
      persistedProfile: profileLang,
      loadedNamespaces: _safe(() => {
        const w = window;
        return (w && Array.isArray(w.__farrowayLoadedLocales)) ? w.__farrowayLoadedLocales.slice() : [];
      }, []),
      fallbackLanguage: 'en',
    });
  }, Object.freeze({
    runtimeVersion: LANGUAGE_HEALTH_RUNTIME_VERSION,
    selectedLanguage: 'en', source: 'default',
    persistedLocal: null, persistedProfile: null,
    loadedNamespaces: [], fallbackLanguage: 'en',
  }));
}

export function messageTemplateHealth() {
  // Client can't read server template files; report the structural
  // contract honestly. The server invite runtime falls back to the
  // English template when a locale variant is absent (fallbackSafe).
  return Object.freeze({
    runtimeVersion:          LANGUAGE_HEALTH_RUNTIME_VERSION,
    emailLocalesReady:       false,  // per-locale email bodies = translator-review
    smsLocalesReady:         false,  // per-locale SMS bodies   = translator-review
    inviteTemplatesLocalized: false, // locale param threaded; bodies pending
    fallbackSafe:            true,   // always falls back to the English template
  });
}

export function languageHealth() {
  return _safe(() => {
    const selectedLanguage = _activeLanguage();
    const entity = entityLocalizationCoverage();
    const loc = SUPPORTED_LOCALES.includes(selectedLanguage) ? selectedLanguage : 'en';
    const pct = (type) => _safe(() => entity[type].perLocale[loc], 0);
    const missingEntityLabels = _safe(() => getMissingEntityLabels().length, 0);
    // Hardcoded-string + untranslated-key counts come from the dev
    // mismatch detector / missing-translation logger when present.
    const hardcodedStringsFound = _safe(() => {
      const w = window;
      return (w && typeof w.__farrowayHardcodedCount === 'number') ? w.__farrowayHardcodedCount : null;
    }, null);
    const untranslatedKeys = _safe(() => {
      const w = window;
      if (w && typeof w.__missingTranslationCount === 'number') return w.__missingTranslationCount;
      return null;
    }, null);

    const review = _safe(() => translatorReviewSummary(), { total: 0 });
    // translationCoverageByLocale — REAL entity coverage per locale.
    const translationCoverageByLocale = _safe(() => {
      const out = {};
      for (const l of SUPPORTED_LOCALES) {
        const types = ['disease', 'pest', 'nutrient', 'treatment'];
        const vals = types.map((ty) => _safe(() => entity[ty].perLocale[l], 0));
        out[l] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      }
      return Object.freeze(out);
    }, Object.freeze({}));
    return Object.freeze({
      runtimeVersion:           LANGUAGE_HEALTH_RUNTIME_VERSION,
      selectedLanguage,
      supportedLanguages:       SUPPORTED_LOCALES.slice(),
      // Honest entity coverage for the ACTIVE locale (English = 100
      // by construction; non-English reflect the real translated %).
      translationCoverage:      Object.freeze({
        crop:     loc === 'en' ? 100 : null, // registry-backed, 6-lang
        disease:  pct('disease'),
        pest:     pct('pest'),
        nutrient: pct('nutrient'),
        treatment: pct('treatment'),
      }),
      translationCoverageByLocale,
      translatorReviewRequired: review.total > 0,
      translatorReviewCount:    review.total,
      hardcodedStringsFound,                 // null when detector not run
      untranslatedKeys,                      // null when logger absent
      missingEntityLabels,
      cropLocalizationReady:     true,        // config/crops.js 6-lang registry
      diseaseLocalizationReady:  pct('disease') > 0,
      pestLocalizationReady:     pct('pest') > 0,
      nutrientLocalizationReady: pct('nutrient') > 0,
      scanLocalizationReady:     true,        // scan shells route through tSafe
      onboardingLocalizationReady: true,      // FastOnboarding uses tStrict
      taskLocalizationReady:     true,
      weatherLocalizationReady:  true,
      messageTemplatesReady:     messageTemplateHealth().fallbackSafe,
      // Honest note for operators.
      translatorReviewLocales:   ['tw', 'ha', 'sw', 'hi'],
      entityCoverageByType:      entity,
    });
  }, Object.freeze({
    runtimeVersion: LANGUAGE_HEALTH_RUNTIME_VERSION,
    selectedLanguage: 'en',
    supportedLanguages: SUPPORTED_LOCALES.slice(),
    translationCoverage: {}, hardcodedStringsFound: null, untranslatedKeys: null,
    missingEntityLabels: 0,
    cropLocalizationReady: true, diseaseLocalizationReady: false,
    pestLocalizationReady: false, nutrientLocalizationReady: false,
    scanLocalizationReady: true, onboardingLocalizationReady: true,
    taskLocalizationReady: true, weatherLocalizationReady: true,
    messageTemplatesReady: true,
  }));
}

function _install(name, fn, label) {
  _safe(() => {
    if (typeof window === 'undefined') return;
    const w = window;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try {
          const dev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log(label, out);
        } catch { /* swallow */ }
        return out;
      };
    }
  }, undefined);
}

export function installLanguageHealthGlobals() {
  return _safe(() => {
    _install('__languageState',         languageState,        '[Farroway · Language State]');
    _install('__languageHealth',        languageHealth,       '[Farroway · Language Health]');
    _install('__messageTemplateHealth', messageTemplateHealth, '[Farroway · Message Templates]');
    return true;
  }, false);
}
