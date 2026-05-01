/**
 * ListingCard — buyer-facing single listing card on /buy.
 *
 * Spec coverage (Buy marketplace §2)
 *   • crop
 *   • quantity
 *   • location
 *   • ready date
 *
 * Pure presentational. Renders an `InterestForm` at the foot so
 * the farmer notification + analytics fire on submit.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import InterestForm from './InterestForm.jsx';
import SellerBadges from '../marketplace/SellerBadges.jsx';
import BoostedBadge from '../marketplace/BoostedBadge.jsx';
import ScarcityBadges from '../marketplace/ScarcityBadges.jsx';

const S = {
  card: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  crop: { margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' },
  unit: {
    fontSize: 12,
    fontWeight: 700,
    color: '#86EFAC',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 8,
  },
  metaCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  metaValue: { fontSize: 14, fontWeight: 700, color: '#fff' },
  priceLine: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
  },
};

function _formatLocation(l) {
  const region  = l?.location?.region  || l?.region  || '';
  const country = l?.location?.country || l?.country || '';
  const parts = [region, country].map((s) => String(s || '').trim()).filter(Boolean);
  return parts.join(', ') || '';
}

function _formatReady(date) {
  if (!date) return '';
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return String(date);
  try { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return String(date); }
}

function _formatQuantity(listing) {
  const qty = listing?.quantity;
  const unit = listing?.unit || '';
  if (qty == null) return '';
  return `${qty}${unit ? ' ' + unit : ''}`;
}

/**
 * @param {object} props
 * @param {object} props.listing  marketStore listing record
 * @param {string} props.buyerId
 * @param {object} [props.prefill]
 * @param {(stored: object) => void} [props.onInterestSubmitted]
 */
export default function ListingCard({
  listing,
  buyerId,
  prefill,
  onInterestSubmitted,
  style,
}) {
  useTranslation();
  if (!listing || !listing.id) return null;

  const cropLabel = String(listing.crop || '').trim();
  const cropDisplay = cropLabel
    ? cropLabel.charAt(0).toUpperCase() + cropLabel.slice(1)
    : tStrict('buy.listing.unknownCrop', 'Unknown crop');

  const qty       = _formatQuantity(listing);
  const location  = _formatLocation(listing);
  const readyDate = _formatReady(listing.readyDate);
  const price     = listing.priceRange ? String(listing.priceRange) : '';

  return (
    <article
      style={{ ...S.card, ...(style || null) }}
      data-testid={`buy-listing-${listing.id}`}
      data-crop={cropLabel.toLowerCase() || ''}
    >
      <div style={S.header}>
        <h3 style={S.crop}>{cropDisplay}</h3>
        {qty ? <span style={S.unit}>{qty}</span> : null}
      </div>

      {/* Marketplace monetization §1: Boosted badge on highlighted
          listings. Self-suppresses when the listing has no active
          boost so non-boosted cards stay calm. */}
      {isFeatureEnabled('marketMonetization') ? (
        <BoostedBadge listingId={listing.id} />
      ) : null}

      {/* Marketplace revenue scale §4: scarcity indicators
          ("Limited quantity" / "High demand"). Self-hides when
          neither flag fires. */}
      {isFeatureEnabled('marketRevenueScale') ? (
        <ScarcityBadges listing={listing} />
      ) : null}

      {/* Marketplace scale §4: seller reputation chips. The badges
          self-suppress when the farmer has earned none, so the
          row stays calm for new sellers. */}
      {isFeatureEnabled('marketScale') && listing.farmerId ? (
        <SellerBadges farmerId={listing.farmerId} />
      ) : null}

      <div style={S.metaGrid}>
        {qty ? (
          <div style={S.metaCard} data-testid="buy-listing-qty">
            <span style={S.metaLabel}>
              {tStrict('buy.listing.quantity', 'Quantity')}
            </span>
            <span style={S.metaValue}>{qty}</span>
          </div>
        ) : (
          <div style={S.metaCard} data-testid="buy-listing-qty">
            <span style={S.metaLabel}>
              {tStrict('buy.listing.quantity', 'Quantity')}
            </span>
            <span style={S.metaValue}>
              {tStrict('buy.listing.qtyOpen', 'To be confirmed')}
            </span>
          </div>
        )}
        {location ? (
          <div style={S.metaCard} data-testid="buy-listing-location">
            <span style={S.metaLabel}>
              {tStrict('buy.listing.location', 'Location')}
            </span>
            <span style={S.metaValue}>{location}</span>
          </div>
        ) : null}
        {readyDate ? (
          <div style={S.metaCard} data-testid="buy-listing-ready">
            <span style={S.metaLabel}>
              {tStrict('buy.listing.readyDate', 'Ready date')}
            </span>
            <span style={S.metaValue}>{readyDate}</span>
          </div>
        ) : null}
      </div>

      {price ? (
        <p style={S.priceLine}>
          {tStrict('buy.listing.priceLabel', 'Asking')}{': '}
          <strong style={{ color: '#fff' }}>{price}</strong>
        </p>
      ) : null}

      <InterestForm
        listing={listing}
        buyerId={buyerId}
        prefill={prefill}
        onSubmitted={onInterestSubmitted}
      />
    </article>
  );
}
