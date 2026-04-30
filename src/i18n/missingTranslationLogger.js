/**
 * missingTranslationLogger.js — re-export façade at the path
 * called out in §11 of the rollout spec.
 *
 * Implementation lives in src/i18n/localeDetection/
 * logMissingTranslation.js — same dev-warn + window-event +
 * capped localStorage queue. We expose it here under the
 * spec-named entry points so callers can do:
 *
 *   import { logMissingTranslation } from '@/i18n/missingTranslationLogger';
 *
 * Behaviour summary:
 *   • dev:        console.warn the missing key
 *   • prod:       silent — never surface the raw key to farmers
 *   • always:     fire `farroway:missingTranslation` window
 *                 event, push entry into the 200-row queue
 */

export {
  logMissingTranslation,
  readMissingTranslationQueue,
  clearMissingTranslationQueue,
} from './localeDetection/logMissingTranslation.js';
