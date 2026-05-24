/**
 * buyerSignalEngine.js — derives BUYER-INTEREST signals from
 * the structured marketplace data we already collect.
 *
 *   import { computeBuyerSignals, BUYER_INTEREST }
 *     from 'src/core/marketplace/buyerSignalEngine.js';
 *
 *   const s = computeBuyerSignals({
 *     listing: { crop: 'tomato', region: 'ashanti', readyAt: '2026-06-01' },
 *     interestEvents: [
 *       { type: 'view',    at: NOW - 1*DAY },
 *       { type: 'contact', at: NOW - 5*HOUR },
 *     ],
 *     nowMs: NOW,
 *   });
 *   // s.interestLevel → 'cold' | 'warm' | 'hot'
 *   // s.signals       → [{ key, fallback, params }]
 *   // s.confidence    → 'low' | 'medium'
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small, hedged classifier. It counts buyer-side activity
 *   (views, saved listings, contact attempts) in a rolling window
 *   and produces a calm label.
 *
 *   It NEVER guarantees a sale, NEVER predicts a price, and
 *   NEVER inflates "interest" beyond what the events show.
 *   Confidence is capped at 'medium' — buyer behaviour is too
 *   noisy to claim certainty.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const BUYER_INTEREST = Object.freeze({
  COLD: 'cold',
  WARM: 'warm',
  HOT:  'hot',
});

const _DAY = 86400000;

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

function _windowEvents(events, nowMs, windowDays) {
  if (!Array.isArray(events)) return [];
  const cutoff = (Number.isFinite(nowMs) ? nowMs : Date.now()) - windowDays * _DAY;
  return events.filter((e) => e && Number.isFinite(Number(e.at)) && Number(e.at) >= cutoff);
}

function _countBy(events, type) {
  return events.filter((e) => e && e.type === type).length;
}

/**
 * Compute buyer-side signals for a listing.
 *
 * @param {object} ctx
 * @returns {object}
 */
export function computeBuyerSignals(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
    const events7  = _windowEvents(c.interestEvents, nowMs, 7);
    const events30 = _windowEvents(c.interestEvents, nowMs, 30);

    const views7    = _countBy(events7, 'view');
    const saved7    = _countBy(events7, 'save') + _countBy(events7, 'saved');
    const contacts7 = _countBy(events7, 'contact');
    const totalRecent = events7.length;
    const total30   = events30.length;

    // Calibration: hot = at least one contact AND >= 5 views OR >= 2 contacts.
    // Warm = >= 3 views OR >= 1 contact OR >= 2 saves.
    // Cold = anything less.
    let interestLevel = BUYER_INTEREST.COLD;
    if ((contacts7 >= 1 && views7 >= 5) || contacts7 >= 2) {
      interestLevel = BUYER_INTEREST.HOT;
    } else if (views7 >= 3 || contacts7 >= 1 || saved7 >= 2) {
      interestLevel = BUYER_INTEREST.WARM;
    }

    const signals = [];
    if (views7 > 0)    signals.push(_msg('marketplace.buyerSignal.views',    'Recent buyer views: {n}.', { n: views7 }));
    if (saved7 > 0)    signals.push(_msg('marketplace.buyerSignal.saved',    'Buyers saved your listing: {n}.', { n: saved7 }));
    if (contacts7 > 0) signals.push(_msg('marketplace.buyerSignal.contacts', 'Buyer contact attempts: {n}.', { n: contacts7 }));
    if (totalRecent === 0) {
      signals.push(_msg('marketplace.buyerSignal.quiet', 'No buyer activity in the last 7 days — that is normal early on.'));
    }

    return {
      ok:           true,
      interestLevel,
      windowDays:   7,
      views:        views7,
      saved:        saved7,
      contacts:     contacts7,
      total30:      total30,
      signals,
      confidence:   total30 >= 5 ? 'medium' : 'low',
      isEstimate:   true,
      disclaimer:   _msg(
        'marketplace.buyerSignal.disclaimer',
        'Buyer interest is an estimate from recent activity — not a guarantee of sale.',
      ),
    };
  } catch {
    return {
      ok: false, interestLevel: BUYER_INTEREST.COLD,
      windowDays: 7, views: 0, saved: 0, contacts: 0, total30: 0,
      signals: [], confidence: 'low', isEstimate: true,
      disclaimer: _msg('marketplace.buyerSignal.disclaimer',
        'Buyer interest is an estimate — not a guarantee of sale.'),
    };
  }
}

const _module = { BUYER_INTEREST, computeBuyerSignals };
export default _module;
