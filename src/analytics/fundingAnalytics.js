/**
 * fundingAnalytics.js — event tracker for the Funding Hub.
 *
 * Same shape and behavior as `regionAnalytics.js` — a 200-entry
 * rolling local log + best-effort forward to the canonical
 * `safeTrackEvent` pipeline. Separate slot so the two surfaces
 * don't pollute each other's debug views.
 *
 * Event names (per spec §9, §10)
 * ──────────────────────────────
 *   funding_page_view         user opened /funding
 *   funding_card_clicked      user tapped a recommendation card
 *   funding_external_link     user followed an external program URL
 *   funding_readiness_change  readiness checklist score changed
 *   funding_pilot_inquiry     user clicked the NGO pilot CTA
 *
 * Strict-rule audit
 *   • Bounded local storage (200 events).
 *   • Defensive — never throws, JSON-serializable payloads only.
 *   • Lazy import of the canonical analytics pipeline keeps this
 *     module safely importable from pure-JS modules.
 */

const STORAGE_KEY = 'farroway_funding_events';
const MAX_KEPT = 200;

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  return false;
}

function _readList() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeList(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_KEPT)));
  } catch { /* quota / private mode */ }
}

function _forward(eventName, payload) {
  try {
    import('../lib/analytics.js')
      .then((mod) => {
        try { mod.safeTrackEvent?.(eventName, payload); }
        catch { /* never propagate */ }
      })
      .catch(() => { /* swallow */ });
  } catch { /* never propagate */ }
}

/**
 * @param {string} eventName
 * @param {object} [payload]  short, JSON-serializable bag
 */
export function trackFundingEvent(eventName, payload = {}) {
  if (!eventName || typeof eventName !== 'string') return;
  let safePayload;
  try {
    safePayload = payload && typeof payload === 'object'
      ? JSON.parse(JSON.stringify(payload))
      : {};
  } catch { safePayload = { __unserialisable: true }; }

  const event = {
    eventName,
    payload:   safePayload,
    timestamp: (() => { try { return new Date().toISOString(); } catch { return ''; } })(),
  };

  if (_isDev()) {
    try { console.log('[Funding Analytics]', event); } catch { /* ignore */ }
  }
  const list = _readList();
  list.push(event);
  _writeList(list);
  _forward(eventName, safePayload);
}

/** Read-only snapshot for debug / admin views. */
export function getRecordedFundingEvents() {
  return _readList();
}

/** Aggregate the rolling log by event name. Used by the admin tile. */
export function summariseFundingEvents() {
  const list = _readList();
  const byEvent = new Map();
  const byCountry = new Map();
  const byRole = new Map();
  const byCardId = new Map();
  let pilotInquiryCount = 0;
  for (const e of list) {
    if (!e || !e.eventName) continue;
    byEvent.set(e.eventName, (byEvent.get(e.eventName) || 0) + 1);
    const p = e.payload || {};
    if (p.country) byCountry.set(p.country, (byCountry.get(p.country) || 0) + 1);
    if (p.userRole) byRole.set(p.userRole, (byRole.get(p.userRole) || 0) + 1);
    if (e.eventName === 'funding_card_clicked' && p.cardId) {
      byCardId.set(p.cardId, (byCardId.get(p.cardId) || 0) + 1);
    }
    if (e.eventName === 'funding_pilot_inquiry') pilotInquiryCount += 1;
  }
  const topCountries = Array.from(byCountry.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topRoles     = Array.from(byRole.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCards     = Array.from(byCardId.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    total:           list.length,
    byEvent:         Object.fromEntries(byEvent),
    topCountries,
    topRoles,
    topCards,
    pilotInquiries:  pilotInquiryCount,
  };
}

/** Wipe the rolling log. Does NOT touch the canonical pipeline. */
export function clearRecordedFundingEvents() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export default {
  trackFundingEvent,
  getRecordedFundingEvents,
  summariseFundingEvents,
  clearRecordedFundingEvents,
};
