/**
 * ListingCard — one crop listing row for buyer search and farmer
 * "my listings". Pure presentational. Buttons + meta are passed in
 * so the same card renders in both contexts.
 *
 * Crop names go through getCropDisplayName so the same listing
 * renders in the active UI language without server round-trip.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';

const STATUS_COLOR = {
  draft:    '#9FB3C8',
  active:   '#22C55E',
  reserved: '#F59E0B',
  sold:     '#0EA5E9',
  closed:   '#6F8299',
};

export default function ListingCard({
  listing,
  trustBadges = [],
  actions = null,
  pendingInterestsCount = 0,
  onClick,
}) {
  const { t, language } = useAppSettings();
  if (!listing) return null;
  const cropLabel = getCropDisplayName(listing.cropKey, language, { bilingual: 'auto' });
  const statusColor = STATUS_COLOR[listing.status] || STATUS_COLOR.active;

  return (
    <article
      style={S.card}
      data-testid={`listing-card-${listing.id}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <header style={S.head}>
        <div style={S.left}>
          <span style={S.crop}>{cropLabel}</span>
          <span style={S.qty}>
            {listing.quantity} {t(`harvest.unit.${listing.unit}`) || listing.unit}
            {' · '}
            {t(`market.quality.${listing.quality}`) || listing.quality}
          </span>
        </div>
        <span style={{ ...S.status, color: statusColor, borderColor: statusColor }}>
          {t(`market.status.${listing.status}`) || listing.status}
        </span>
      </header>

      <div style={S.meta}>
        <span>
          {[listing.city, listing.stateCode, listing.country].filter(Boolean).join(', ')}
        </span>
        {listing.price && (
          <span style={S.price}>
            {listing.price} · {t(`market.pricingMode.${listing.pricingMode}`) || listing.pricingMode}
          </span>
        )}
        {!listing.price && (
          <span style={S.priceMuted}>
            {t(`market.pricingMode.${listing.pricingMode}`) || listing.pricingMode}
          </span>
        )}
      </div>

      {listing.deliveryMode && (
        <div style={S.meta}>
          <span style={S.deliveryTag}>
            {t(`market.delivery.${listing.deliveryMode}`) || listing.deliveryMode}
          </span>
        </div>
      )}

      {trustBadges?.length > 0 && (
        <ul style={S.badges}>
          {trustBadges.map((k) => (
            <li key={k} style={S.badge}>{t(k)}</li>
          ))}
        </ul>
      )}

      {pendingInterestsCount > 0 && (
        <div style={S.interestCount} data-testid="pending-interests">
          {t('market.pendingInterests', { count: pendingInterestsCount })
            || `${pendingInterestsCount} interested buyers`}
        </div>
      )}

      {actions && <div style={S.actions}>{actions}</div>}
    </article>
  );
}

const S = {
  card: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#EAF2FF',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    cursor: 'inherit',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  left: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  crop: { fontSize: '1rem', fontWeight: 700 },
  qty: { fontSize: '0.8125rem', color: '#9FB3C8' },
  status: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    border: '1px solid', fontSize: '0.6875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  meta: {
    display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
    alignItems: 'center', fontSize: '0.8125rem', color: '#9FB3C8',
  },
  price: { color: '#EAF2FF', fontWeight: 600 },
  priceMuted: { color: '#9FB3C8', fontStyle: 'italic' },
  deliveryTag: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)', color: '#EAF2FF',
    fontSize: '0.6875rem', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  badges: {
    margin: 0, padding: 0, listStyle: 'none',
    display: 'flex', flexWrap: 'wrap', gap: '0.25rem',
  },
  badge: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.10)', color: '#22C55E',
    fontSize: '0.625rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  interestCount: {
    padding: '0.375rem 0.625rem', borderRadius: '8px',
    background: 'rgba(14,165,233,0.10)', color: '#0EA5E9',
    fontSize: '0.8125rem', fontWeight: 700,
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' },
};
