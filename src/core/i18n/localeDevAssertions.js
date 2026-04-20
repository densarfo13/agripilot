/**
 * localeDevAssertions.js — Section 12. Dev-only warnings that
 * surface localization regressions loud and early.
 *
 * All assertions are silent in production, silent on unmet
 * preconditions, and log `console.warn` with a stable tag
 * when the contract is violated.
 */

import {
  isLocalizedPayload,
  validateLocalizedPayload,
  isRenderedString,
} from './localizedPayload.js';
import { looksLikeRawKey } from './renderLocalizedMessage.js';

const TAG = '[farroway.i18n]';

function isDev() {
  if (typeof window === 'undefined') return false;
  const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV)
    || 'development';
  return env !== 'production';
}

function warn(reason, details = {}) {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.warn(TAG, reason, { ...details, at: new Date().toISOString() });
}

/** §12: rendered visible string IS a raw key ("insight.good_week"). */
export function assertNotRawKey(rendered, details = {}) {
  if (!isDev()) return;
  if (typeof rendered !== 'string') return;
  if (!looksLikeRawKey(rendered)) return;
  warn('rendered visible string is raw key', { ...details, rendered });
}

/**
 * §12: engine emitted a plain string instead of a structured
 * LocalizedPayload. This is how "English leaks" happen.
 */
export function assertEngineEmitsPayload(value, details = {}) {
  if (!isDev()) return;
  if (value == null) return;
  if (isLocalizedPayload(value)) return;
  if (!isRenderedString(value)) return; // empty, numeric, etc. — caller's problem
  warn('engine returns plain string instead of key/params object', {
    ...details, sample: String(value).slice(0, 60),
  });
}

/** §12: structured payload missing `.key`. */
export function assertPayloadHasKey(payload, details = {}) {
  if (!isDev()) return;
  const { ok, reasons } = validateLocalizedPayload(payload);
  if (ok) return;
  if (!reasons.includes('missing_key')) return;
  warn('structured payload missing key', { ...details, reasons });
}

/**
 * §12: rendered visible text in a non-English locale looks like
 * uncategorized English — i.e. only ASCII letters and long enough
 * to be unlikely to be an intentional technical token.
 *
 * Deliberately conservative to keep noise low.
 */
export function assertNoEnglishLeakInLocale(locale, rendered, details = {}) {
  if (!isDev()) return;
  if (!locale || locale === 'en') return;
  if (typeof rendered !== 'string' || rendered.trim().length < 8) return;
  // Heuristic by script:
  //   hi → Devanagari expected
  //   ar → Arabic expected
  //   pt/es/fr/sw/tw/id → Latin script; leak detection uses a
  //     stopword signal (these locales should contain localized
  //     diacritics / non-English function words).
  const mostlyAscii = /^[\x00-\x7F]+$/.test(rendered);
  if (!mostlyAscii) return;

  switch (locale) {
    case 'hi':
      if (!/[\u0900-\u097F]/.test(rendered)) {
        warn('likely English leak in Hindi mode', { ...details, rendered: rendered.slice(0, 60) });
      }
      return;
    case 'ar':
      if (!/[\u0600-\u06FF]/.test(rendered)) {
        warn('likely English leak in Arabic mode', { ...details, rendered: rendered.slice(0, 60) });
      }
      return;
    default:
      // Latin-script locales — much noisier heuristic, so only warn
      // when the text contains common English function words that
      // a locale-specific copy would rarely contain verbatim.
      if (/\b(the|and|your|this|please)\b/i.test(rendered)) {
        warn(`likely English leak in ${locale} mode`, { ...details, rendered: rendered.slice(0, 60) });
      }
      return;
  }
}

/**
 * §9: when we receive a cached insight payload, warn if it
 * contains a pre-rendered string field instead of a key.
 */
export function assertCachedPayloadIsStructured(cached, details = {}) {
  if (!isDev()) return;
  if (!cached || typeof cached !== 'object') return;
  // Common fields that should be payloads, never strings.
  for (const field of ['insight', 'title', 'subtitle', 'why', 'next']) {
    const v = cached[field];
    if (v == null) continue;
    if (typeof v === 'string' && isRenderedString(v)) {
      warn('cached payload contains rendered string instead of structured key', {
        ...details, field, sample: String(v).slice(0, 60),
      });
    }
  }
}

export const _internal = { TAG };
