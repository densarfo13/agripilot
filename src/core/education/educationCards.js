/**
 * educationCards.js — micro-help / education content (v2 §6, §9).
 *
 *   import { listEducationCards, getEducationCard, localizeCard }
 *     from 'src/core/education/educationCards.js';
 *
 * What it is
 * ──────────
 *   A small, pure registry of short education + help cards:
 *   confidence explainer, scan tips, weather→task explanation,
 *   disease-risk explanation, notification explanation,
 *   marketplace explanation, plus help-centre topics (offline,
 *   language, report-issue). One card system serves both the
 *   in-context micro-help (§6) and the lightweight help centre
 *   (§9) — no parallel content trees.
 *
 * Localization
 *   Each card carries a translation `key` AND an English
 *   `fallback`. The caller localizes via its own translator —
 *   `localizeCard(card, t)` where `t(key, fallback)` is a tSafe-
 *   style function. No new keys are added to translations.js, so
 *   the translation parity gate is unaffected; missing keys
 *   degrade gracefully to the English fallback.
 *
 * Voice readout
 *   `voiceReadoutText(card, t)` returns a plain, punctuation-light
 *   string suitable for an optional text-to-speech readout.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Frozen data. No I/O.
 */

export const EDUCATION_TOPIC = Object.freeze({
  CONFIDENCE:   'confidence',
  SCAN:         'scan',
  WEATHER:      'weather',
  DISEASE_RISK: 'disease_risk',
  NOTIFICATION: 'notification',
  MARKETPLACE:  'marketplace',
  OFFLINE:      'offline',
  LANGUAGE:     'language',
  SUPPORT:      'support',
});

const CARDS = Object.freeze([
  Object.freeze({
    id: 'confidence_explainer', topic: EDUCATION_TOPIC.CONFIDENCE,
    titleKey: 'edu.confidence.title', titleFallback: 'What confidence means',
    bodyKey: 'edu.confidence.body',
    bodyFallback: 'Farroway says "likely", "possible", or "needs review" — never "confirmed". A scan is a helpful guide, not a final diagnosis. When in doubt, check the plant yourself or ask a local expert.',
  }),
  Object.freeze({
    id: 'scan_tips', topic: EDUCATION_TOPIC.SCAN,
    titleKey: 'edu.scan.title', titleFallback: 'How to take a better scan photo',
    bodyKey: 'edu.scan.body',
    bodyFallback: 'Use daylight, not a dark room. Hold steady so the photo is sharp. Fill the frame with one leaf or plant. If the result looks unsure, retake the photo or use the manual symptom picker.',
  }),
  Object.freeze({
    id: 'weather_task', topic: EDUCATION_TOPIC.WEATHER,
    titleKey: 'edu.weather.title', titleFallback: 'Why your tasks change with the weather',
    bodyKey: 'edu.weather.body',
    bodyFallback: 'Rain, heat, and dry spells change what your plants need. Farroway updates your daily tasks so the advice matches the weather you actually have.',
  }),
  Object.freeze({
    id: 'disease_risk', topic: EDUCATION_TOPIC.DISEASE_RISK,
    titleKey: 'edu.disease.title', titleFallback: 'What a disease-risk alert means',
    bodyKey: 'edu.disease.body',
    bodyFallback: 'A risk alert means conditions could favour a problem — it is a heads-up to check, not proof of disease. Look at your plants; if you see nothing, the alert simply means stay watchful.',
  }),
  Object.freeze({
    id: 'notification_explainer', topic: EDUCATION_TOPIC.NOTIFICATION,
    titleKey: 'edu.notification.title', titleFallback: 'How notifications work',
    bodyKey: 'edu.notification.body',
    bodyFallback: 'Farroway sends only a few, useful notifications — weather risk, a scan follow-up, a task due. Every notification is also kept in the app so you never miss one.',
  }),
  Object.freeze({
    id: 'marketplace_explainer', topic: EDUCATION_TOPIC.MARKETPLACE,
    titleKey: 'edu.marketplace.title', titleFallback: 'How marketplace listings work',
    bodyKey: 'edu.marketplace.body',
    bodyFallback: 'Listing indicators (freshness, recently scanned, harvest readiness) help buyers judge a listing. They are activity signals — not a quality guarantee. Always agree details directly with the seller.',
  }),
  Object.freeze({
    id: 'offline_help', topic: EDUCATION_TOPIC.OFFLINE,
    titleKey: 'edu.offline.title', titleFallback: 'Using Farroway offline',
    bodyKey: 'edu.offline.body',
    bodyFallback: 'If your connection drops, Farroway keeps working with what it has and saves your actions. They sync automatically when you are back online.',
  }),
  Object.freeze({
    id: 'language_help', topic: EDUCATION_TOPIC.LANGUAGE,
    titleKey: 'edu.language.title', titleFallback: 'Changing your language',
    bodyKey: 'edu.language.body',
    bodyFallback: 'You can change Farroway’s language in settings at any time. If a phrase has not been translated yet, it shows in English so you are never blocked.',
  }),
  Object.freeze({
    id: 'report_issue_help', topic: EDUCATION_TOPIC.SUPPORT,
    titleKey: 'edu.support.title', titleFallback: 'Reporting a problem',
    bodyKey: 'edu.support.body',
    bodyFallback: 'If something looks wrong, use "Report an issue". A field officer reviews every report — nothing is ignored and nothing auto-resolves.',
  }),
]);

const _CARD_BY_ID = Object.freeze(
  CARDS.reduce((m, c) => { m[c.id] = c; return m; }, {}),
);

/** All cards, or all cards for one topic when `topic` is given. */
export function listEducationCards(topic) {
  if (!topic) return CARDS.slice();
  const t = String(topic).toLowerCase();
  return CARDS.filter((c) => c.topic === t);
}

/** A single card by id, or null. */
export function getEducationCard(id) {
  return _CARD_BY_ID[String(id || '')] || null;
}

/**
 * Localize a card with a tSafe-style translator `t(key, fallback)`.
 * Falls back to plain English if no translator is supplied.
 *
 * @returns {{ id:string, topic:string, title:string, body:string }}
 */
export function localizeCard(card, t) {
  if (!card || typeof card !== 'object') return null;
  const tr = (typeof t === 'function')
    ? t
    : (_k, fb) => fb;
  return {
    id:    card.id,
    topic: card.topic,
    title: tr(card.titleKey, card.titleFallback),
    body:  tr(card.bodyKey, card.bodyFallback),
  };
}

/** Plain text for an optional voice readout. */
export function voiceReadoutText(card, t) {
  const c = localizeCard(card, t);
  if (!c) return '';
  return `${c.title}. ${c.body}`.replace(/\s+/g, ' ').trim();
}

const _module = {
  EDUCATION_TOPIC,
  listEducationCards,
  getEducationCard,
  localizeCard,
  voiceReadoutText,
};
export default _module;
