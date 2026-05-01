/**
 * OperatorInterestQueue — pending-interests queue for the
 * operator dashboard.
 *
 * Spec coverage (Aggressive scaling §2)
 *   • Manage listings + connect buyers.
 *
 * Behaviour
 *   • Lists every interest in `interested` state for the focused
 *     market.
 *   • Per-row actions:
 *       Mark contacted    → transitions interest (existing flow)
 *       Mark deal closed  → transitions interest to `sold` and
 *                           closes the listing
 *       Copy buyer info   → clipboard for an offline conversation
 *   • Each action emits a market-tagged analytics event via
 *     trackMarketEvent so per-region funnels stay clean.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getCropLabel } from '../../utils/crops.js';
import { transitionInterest } from '../../market/marketTransaction.js';
import { markListingSold } from '../../market/marketStore.js';
import { trackMarketEvent } from '../../markets/marketAnalytics.js';
import { getPendingInterestsForMarket } from '../../operator/operatorMetrics.js';

const S = {
  panel: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  heading: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  empty: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10,
  },
  rowHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  buyerInfo: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  buyerName: { fontSize: 14, fontWeight: 800, color: '#fff' },
  buyerSub:  { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  rowMeta:   { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
  },
  copiedTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontWeight: 700,
    color: '#86EFAC',
  },
};

function _formatRelative(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return tStrict('common.minutesAgo', '{n} min ago').replace('{n}', String(m));
  const h = Math.round(m / 60);
  if (h < 24) return tStrict('common.hoursAgo', '{n}h ago').replace('{n}', String(h));
  const d = Math.round(h / 24);
  return tStrict('common.daysAgo', '{n}d ago').replace('{n}', String(d));
}

/**
 * @param {object} props
 * @param {string} props.marketId
 * @param {object} [props.style]
 */
export default function OperatorInterestQueue({ marketId, style }) {
  const { lang } = useTranslation();
  const [tick, setTick] = useState(0);
  const [copiedFor, setCopiedFor] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    const evts = ['farroway:market_changed', 'storage'];
    try { for (const e of evts) window.addEventListener(e, handler); }
    catch { /* swallow */ }
    return () => {
      try { for (const e of evts) window.removeEventListener(e, handler); }
      catch { /* swallow */ }
    };
  }, []);

  const queue = useMemo(() => {
    if (!marketId) return [];
    try { return getPendingInterestsForMarket(marketId); }
    catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, tick]);

  const handleContact = useCallback((interest) => {
    if (!interest || !interest.id) return;
    try { transitionInterest(interest.id, 'contacted'); } catch { /* swallow */ }
    try {
      trackMarketEvent('operator_marked_contacted', {
        interestId: interest.id,
        listingId:  interest.listingId,
      });
    } catch { /* swallow */ }
  }, []);

  const handleClose = useCallback((interest) => {
    if (!interest || !interest.id) return;
    try { transitionInterest(interest.id, 'sold'); } catch { /* swallow */ }
    try { markListingSold(interest.listingId); } catch { /* swallow */ }
    try {
      trackMarketEvent('operator_closed_deal', {
        interestId: interest.id,
        listingId:  interest.listingId,
      });
    } catch { /* swallow */ }
  }, []);

  const handleCopy = useCallback(async (interest, listing) => {
    if (!interest) return;
    const cropLabel = listing?.crop
      ? (getCropLabel(listing.crop, lang) || listing.crop)
      : '';
    const text = [
      interest.buyerName || '',
      cropLabel ? `Wants: ${cropLabel} (${listing.quantity || '?'} ${listing.unit || ''})` : '',
      interest.buyerPhone ? `Phone: ${interest.buyerPhone}` : '',
      interest.message ? `Note: ${interest.message}` : '',
    ].filter(Boolean).join(' \u00B7 ');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch { /* swallow */ }
    try {
      trackMarketEvent('operator_copied_buyer', {
        interestId: interest.id,
        listingId:  interest.listingId,
      });
    } catch { /* swallow */ }
    setCopiedFor(interest.id);
  }, []);

  return (
    <section
      style={{ ...S.panel, ...(style || null) }}
      data-testid="operator-interest-queue"
      data-market={marketId || ''}
    >
      <h3 style={S.heading}>
        {tStrict('operator.queue.title', 'Pending interests')}
      </h3>

      {queue.length === 0 ? (
        <p style={S.empty}>
          {tStrict('operator.queue.empty',
            'Nothing pending in this market \u2014 you\u2019re caught up.')}
        </p>
      ) : (
        <div style={S.list}>
          {queue.map(({ interest, listing }) => {
            const buyerLocation = String(interest?.message || '').split(' \u00B7 ')[0] || '';
            return (
              <div
                key={interest.id}
                style={S.row}
                data-testid={`operator-interest-${interest.id}`}
              >
                <div style={S.rowHead}>
                  <div style={S.buyerInfo}>
                    <span style={S.buyerName}>
                      {interest.buyerName
                        || tStrict('market.interest.fallbackBuyerName', 'there')}
                    </span>
                    <span style={S.buyerSub}>
                      {[
                        listing?.crop
                          && `${getCropLabel(listing.crop, lang) || listing.crop} (${listing.quantity || '?'} ${listing.unit || ''})`,
                        buyerLocation,
                        _formatRelative(interest.createdAt),
                      ].filter(Boolean).join(' \u00B7 ')}
                    </span>
                  </div>
                </div>
                <div style={S.actionRow}>
                  <button
                    type="button"
                    onClick={() => handleContact(interest)}
                    style={{ ...S.actionBtn, ...S.primaryBtn }}
                    data-testid={`operator-action-contact-${interest.id}`}
                  >
                    {tStrict('operator.action.contact', 'Mark contacted')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClose(interest)}
                    style={S.actionBtn}
                    data-testid={`operator-action-close-${interest.id}`}
                  >
                    {tStrict('operator.action.close', 'Mark deal closed')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(interest, listing)}
                    style={S.actionBtn}
                    data-testid={`operator-action-copy-${interest.id}`}
                  >
                    {copiedFor === interest.id ? (
                      <span style={S.copiedTag}>
                        <span aria-hidden="true">{'\u2714'}</span>
                        <span>{tStrict('common.copied', 'Copied')}</span>
                      </span>
                    ) : tStrict('operator.action.copy', 'Copy buyer info')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
