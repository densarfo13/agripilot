/**
 * FarmerInterestPanel — list of buyer interests for a single
 * listing on the farmer's /sell screen.
 *
 * Spec coverage (Improve transaction flow §1, §2, §4, §5)
 *   §1 surfaces the count headline ("1 buyer is interested")
 *   §2 actions: Contact buyer / Mark negotiating / Accept interest
 *   §4 status pill per interest
 *   §5 stale-interest nudge ("Some buyers are still waiting")
 *
 * Position
 *   Mounts inline under the existing "Your listing" status card
 *   on /sell when the `marketTransactionFlow` flag is on. The
 *   legacy "View buyers" chip is preserved as a sibling so
 *   farmers can still deep-link to /marketplace if they prefer
 *   the existing detail page.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Reads from the existing `getBuyerInterests` store.
 *   • State transitions go through `transitionInterest` so the
 *     analytics events + change broadcast stay canonical.
 *   • Auto-refreshes on `farroway:market_changed`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getBuyerInterests, markListingSold } from '../../market/marketStore.js';
import {
  transitionInterest,
  statusTone,
  statusLabel,
  getStaleInterests,
} from '../../market/marketTransaction.js';
import { isFeatureEnabled } from '../../config/features.js';
import ContactBuyerModal from './ContactBuyerModal.jsx';
import RepeatPromptCard from './RepeatPromptCard.jsx';
import BoostListingButton from './BoostListingButton.jsx';
import AssistedDealButton from './AssistedDealButton.jsx';

const S = {
  panel: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    color: '#EAF2FF',
    marginTop: 10,
  },
  headRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headline: { margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' },
  empty: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  staleBanner: {
    fontSize: 12,
    color: '#FDE68A',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  rowHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  buyerInfo: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  buyerName: { fontSize: 14, fontWeight: 700, color: '#fff' },
  buyerSub:  { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    flex: '0 0 auto',
  },
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
  acceptBtn: {
    background: 'rgba(34,197,94,0.18)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
  },
};

function _formatRelative(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const delta = Date.now() - t;
  const m = Math.round(delta / 60000);
  if (m < 1)  return tStrict('common.justNow', 'just now');
  if (m < 60) return tStrict('common.minutesAgo', '{n} min ago').replace('{n}', String(m));
  const h = Math.round(m / 60);
  if (h < 24) return tStrict('common.hoursAgo', '{n}h ago').replace('{n}', String(h));
  const d = Math.round(h / 24);
  return tStrict('common.daysAgo', '{n}d ago').replace('{n}', String(d));
}

/**
 * @param {object} props
 * @param {object} props.listing
 * @param {string} [props.farmerName]
 * @param {object} [props.style]
 */
export default function FarmerInterestPanel({ listing, farmerName = '', style }) {
  useTranslation();
  const [tick, setTick] = useState(0);
  const [contactBuyer, setContactBuyer] = useState(null);

  // Auto-refresh on cross-component change events.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    try {
      window.addEventListener('farroway:market_changed', handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener('farroway:market_changed', handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const interests = useMemo(() => {
    try {
      const all = getBuyerInterests() || [];
      return all.filter((i) => i && i.listingId === listing?.id);
    } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing && listing.id, tick]);

  const stale = useMemo(() => getStaleInterests(interests), [interests]);
  const hasSold = useMemo(
    () => interests.some((i) => (i?.status || 'interested') === 'sold'),
    [interests],
  );

  const handleContact = useCallback((interest) => {
    setContactBuyer(interest);
  }, []);

  const handleNegotiating = useCallback((interest) => {
    try { transitionInterest(interest.id, 'negotiating'); }
    catch { /* swallow */ }
  }, []);

  const handleAccept = useCallback((interest) => {
    try { transitionInterest(interest.id, 'sold'); } catch { /* swallow */ }
    // Acceptance closes the listing for further buyers.
    try { markListingSold(listing?.id); } catch { /* swallow */ }
  }, [listing && listing.id]);

  if (!listing || !listing.id) return null;

  const count = interests.length;

  return (
    <section
      style={{ ...S.panel, ...(style || null) }}
      data-testid={`farmer-interest-panel-${listing.id}`}
    >
      <div style={S.headRow}>
        <h3 style={S.headline}>
          {count === 0
            ? tStrict('market.interest.noneYet', 'No buyers yet')
            : count === 1
              ? tStrict('market.interest.countOne', '1 buyer is interested')
              : tStrict('market.interest.countMany', '{count} buyers are interested')
                  .replace('{count}', String(count))}
        </h3>
        {/* Marketplace monetization §1: Boost CTA next to the
            count headline. Self-hides when the flag is off and
            shows a calm "Boosted" pill once the listing is live. */}
        <BoostListingButton listing={listing} />
      </div>

      {stale.length > 0 ? (
        <div style={S.staleBanner} data-testid="farmer-interest-stale-banner">
          <span aria-hidden="true">{'\u23F3'}</span>
          <span>
            {stale.length === 1
              ? tStrict('market.interest.staleOne',
                  'A buyer is still waiting \u2014 reply to keep them engaged.')
              : tStrict('market.interest.staleMany',
                  '{count} buyers are still waiting \u2014 reply to keep them engaged.')
                  .replace('{count}', String(stale.length))}
          </span>
        </div>
      ) : null}

      {count === 0 ? (
        <p style={S.empty}>
          {tStrict('market.interest.empty',
            'When a buyer taps "I\u2019m interested", you\u2019ll see them here.')}
        </p>
      ) : (
        <div style={S.list}>
          {interests.map((interest) => {
            const status = interest.status || 'interested';
            const tone = statusTone(status);
            const isSold = status === 'sold';
            const buyerLocation = String(interest.message || '').split(' \u00B7 ')[0] || '';
            const buyerNote     = String(interest.message || '').split(' \u00B7 ').slice(1).join(' \u00B7 ');
            return (
              <div
                key={interest.id}
                style={S.row}
                data-testid={`farmer-interest-row-${interest.id}`}
                data-status={status}
              >
                <div style={S.rowHead}>
                  <div style={S.buyerInfo}>
                    <span style={S.buyerName}>
                      {interest.buyerName || tStrict('market.interest.fallbackBuyerName', 'there')}
                    </span>
                    <span style={S.buyerSub}>
                      {[buyerLocation, _formatRelative(interest.createdAt)]
                        .filter(Boolean).join(' \u00B7 ')}
                    </span>
                    {buyerNote ? (
                      <span style={S.buyerSub}>{buyerNote}</span>
                    ) : null}
                  </div>
                  <span
                    style={{
                      ...S.pill,
                      color: tone.color,
                      background: tone.bg,
                      border: `1px solid ${tone.border}`,
                    }}
                    data-testid={`farmer-interest-status-${interest.id}`}
                  >
                    {statusLabel(status)}
                  </span>
                </div>
                {!isSold ? (
                  <div style={S.actionRow}>
                    {(status === 'interested') ? (
                      <button
                        type="button"
                        onClick={() => handleContact(interest)}
                        style={{ ...S.actionBtn, ...S.primaryBtn }}
                        data-testid={`farmer-interest-contact-${interest.id}`}
                      >
                        {tStrict('market.interest.action.contact', 'Contact buyer')}
                      </button>
                    ) : null}
                    {(status === 'contacted') ? (
                      <button
                        type="button"
                        onClick={() => handleNegotiating(interest)}
                        style={S.actionBtn}
                        data-testid={`farmer-interest-negotiating-${interest.id}`}
                      >
                        {tStrict('market.interest.action.markNegotiating',
                          'Mark as negotiating')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleAccept(interest)}
                      style={{ ...S.actionBtn, ...S.acceptBtn }}
                      data-testid={`farmer-interest-accept-${interest.id}`}
                    >
                      {tStrict('market.interest.action.accept', 'Accept interest')}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Marketplace monetization §2: "Get help closing deal".
          Surfaces only after at least one buyer has shown
          interest — a deal needs a counterparty before assist
          makes sense. Self-hides while sold (deal is closed). */}
      {count > 0 && !hasSold ? (
        <AssistedDealButton
          listing={listing}
          farmerName={farmerName}
        />
      ) : null}

      <ContactBuyerModal
        open={!!contactBuyer}
        listing={listing}
        buyer={contactBuyer}
        farmerName={farmerName}
        onClose={() => setContactBuyer(null)}
      />

      {/* Marketplace scale §3: when a sale closes, surface the
          repeat-prompt to invite the farmer to list another crop
          while interest is still warm. Self-suppresses behind
          the marketScale flag. */}
      {isFeatureEnabled('marketScale') && hasSold ? (
        <RepeatPromptCard role="seller" />
      ) : null}
    </section>
  );
}
