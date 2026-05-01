/**
 * Buy — buyer-facing marketplace at `/buy`.
 *
 *   <Route path="/buy" element={<Buy />} />
 *
 * Spec contract (Buy marketplace)
 *   §1 route at /buy
 *   §2 each listing shows crop / quantity / location / ready date
 *   §3 "I'm interested" → saves listingId + buyerId + timestamp
 *   §4 farmer is notified ("Someone is interested in your produce")
 *   §5 buyer info: name + location + optional message
 *   §7 emits `interest_clicked` / `listing_viewed` / `listing_created`
 *   §8 keeps it simple — no payments / logistics / negotiation
 *
 * Position
 *   This page coexists with the existing /market/browse +
 *   /market/listings/:id surfaces. Those carry richer UI (filters,
 *   detail view); /buy is a flat, single-page list optimised for
 *   the simplest tap-and-go interest flow. Existing routes stay
 *   verbatim so deep links continue to work.
 *
 * Strict-rule audit
 *   • Reads from `getActiveListings()` — no new storage key.
 *   • Each card mounts an `InterestForm` that calls the existing
 *     `saveBuyerInterest`, which in turn fires the existing farmer
 *     notification (NOTIFICATION_TYPES.BUYER) + analytics. We do
 *     not reimplement any of those pipelines.
 *   • Self-hides behind `buyMarketplace` flag — flag-off path
 *     renders a small "coming soon" notice so a stray nav tap
 *     doesn't 404.
 *   • All visible text via tStrict.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import { trackEvent } from '../analytics/analyticsStore.js';
import { useAuth }    from '../context/AuthContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { getActiveListings } from '../market/marketStore.js';
import { getBuyerId }       from '../market/buyerIdentity.js';
import { sortListingsByRelevance } from '../market/listingPriority.js';
import { getBuyerAlerts, markAllAlertsRead } from '../market/buyerNotifications.js';
import ListingCard from '../components/buy/ListingCard.jsx';
import BuyerPriorityCard from '../components/marketplace/BuyerPriorityCard.jsx';
import QuickReorderStrip from '../components/marketplace/QuickReorderStrip.jsx';

const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '20px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.45,
  },
  countPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
  },
  listings: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  emptyCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '20px 16px',
    color: '#fff',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  emptyIcon: { fontSize: 28, lineHeight: 1 },
  cta: {
    appearance: 'none',
    border: 'none',
    padding: '12px 16px',
    borderRadius: 12,
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  comingSoon: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '20px 16px',
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    fontSize: 14,
  },
};

export default function Buy() {
  useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  const flagOn = isFeatureEnabled('buyMarketplace');

  // Stable buyer identity for this device + auth user (if any).
  const buyerId = useMemo(() => getBuyerId(user), [user]);

  // Read listings synchronously from localStorage on mount + when
  // a user submits interest (the InterestForm's onSubmitted bumps
  // a refresh tick so a freshly-listed cohort can roll in).
  const [tick, setTick] = useState(0);
  const scaleOn   = isFeatureEnabled('marketScale');
  const revenueOn = isFeatureEnabled('marketRevenueScale');

  // Quick-reorder filter — sticky to the strip's chip selection.
  const [activeCrop, setActiveCrop] = useState('');

  const listings = useMemo(() => {
    try {
      const all = getActiveListings() || [];
      // Apply the Quick Reorder filter first so the priority sort
      // operates on the focused subset.
      const filtered = (revenueOn && activeCrop)
        ? all.filter((l) =>
            String(l?.crop || '').trim().toLowerCase()
              === String(activeCrop).trim().toLowerCase())
        : all;
      if (scaleOn || revenueOn) {
        // Marketplace scale §6 / revenue scale §1: priority sort
        // bumps boosted → past-interest → top-selling → cluster →
        // newest, in that order.
        return sortListingsByRelevance(filtered, { buyerId });
      }
      return filtered.slice().sort((a, b) =>
        Date.parse(b?.createdAt || 0) - Date.parse(a?.createdAt || 0));
    } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, scaleOn, revenueOn, buyerId, activeCrop]);

  // Marketplace scale §1: surface unread "new listing" alerts.
  // The component itself is small + inline so we don't need a
  // separate file.
  const unreadAlerts = useMemo(() => {
    if (!scaleOn) return [];
    try { return getBuyerAlerts(buyerId, { unreadOnly: true }) || []; }
    catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleOn, buyerId, tick]);

  // Per-spec §7: emit `listing_viewed` once per page mount with
  // the count so the analytics dashboard can chart the buyer
  // funnel. Each listing card's "I'm interested" tap fires the
  // companion `interest_clicked` event from InterestForm.
  useEffect(() => {
    try {
      trackEvent('listing_viewed', {
        source: 'buy_page',
        count:  listings.length,
      });
    } catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefill = useMemo(() => ({
    buyerName:
      (user && (user.fullName || user.name)) ||
      (profile && (profile.fullName || profile.farmerName)) || '',
    buyerLocation: (profile && profile.region) || '',
  }), [user, profile]);

  // Flag-off path — calm "coming soon" so a stray nav tap doesn't
  // land on an empty page or a 404. Existing /marketplace and
  // /market/browse routes are untouched.
  if (!flagOn) {
    return (
      <main style={S.page} data-screen="buy-coming-soon">
        <h1 style={S.title}>
          {tStrict('buy.title', 'Buy')}
        </h1>
        <div style={S.comingSoon}>
          {tStrict('buy.comingSoon',
            'Buyer marketplace is coming soon. Check back shortly.')}
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-screen="buy">
      <header style={S.headerRow}>
        <div>
          <h1 style={S.title}>
            {tStrict('buy.title', 'Buy')}
          </h1>
          <p style={S.subtitle}>
            {tStrict('buy.subtitle',
              'See produce listed by nearby farmers. Tap "I\u2019m interested" to connect.')}
          </p>
        </div>
        {listings.length > 0 ? (
          <span style={S.countPill} data-testid="buy-count">
            {tStrict('buy.countPill', '{count} listings')
              .replace('{count}', String(listings.length))}
          </span>
        ) : null}
      </header>

      {/* Marketplace monetization §3: buyer priority opt-in card.
          Self-hides when `marketMonetization` is off. */}
      <BuyerPriorityCard />

      {/* Marketplace revenue scale §5: Quick Reorder strip with
          previously preferred + recurring-supply crops. Self-hides
          when the buyer has no preferences yet. */}
      {revenueOn ? (
        <QuickReorderStrip
          buyerId={buyerId}
          activeCrop={activeCrop}
          onCropPick={setActiveCrop}
        />
      ) : null}

      {scaleOn && unreadAlerts.length > 0 ? (
        <div
          style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.40)',
            borderRadius: 12,
            padding: '10px 12px',
            color: '#BBF7D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 13,
          }}
          data-testid="buy-new-listing-alerts"
        >
          <span>
            {unreadAlerts.length === 1
              ? tStrict('market.newListingAlert.one',
                  'A new {crop} listing matches your interest.')
                  .replace('{crop}', String(unreadAlerts[0].crop || ''))
              : tStrict('market.newListingAlert.many',
                  '{count} new listings match your past interests.')
                  .replace('{count}', String(unreadAlerts.length))}
          </span>
          <button
            type="button"
            onClick={() => {
              try { markAllAlertsRead(buyerId); } catch { /* swallow */ }
              setTick((n) => (n + 1) % 1_000_000);
            }}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              color: '#BBF7D0',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
            data-testid="buy-alerts-mark-read"
          >
            {tStrict('common.gotIt', 'Got it')}
          </button>
        </div>
      ) : null}

      {listings.length === 0 ? (
        <section style={S.emptyCard} data-testid="buy-empty">
          <span style={S.emptyIcon} aria-hidden="true">{'\uD83C\uDF3E'}</span>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
            {tStrict('buy.empty.title', 'No produce listed yet')}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            {tStrict('buy.empty.body',
              'When a farmer lists produce, you\u2019ll see it here. You can also list your own.')}
          </p>
          <button
            type="button"
            onClick={() => { try { navigate('/sell'); } catch { /* swallow */ } }}
            style={S.cta}
            data-testid="buy-empty-list-cta"
          >
            {tStrict('market.createListing', 'List my produce')}
          </button>
        </section>
      ) : (
        <section style={S.listings}>
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              buyerId={buyerId}
              prefill={prefill}
              onInterestSubmitted={() => setTick((n) => (n + 1) % 1_000_000)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
