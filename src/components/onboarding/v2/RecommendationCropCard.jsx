/**
 * RecommendationCropCard — single-crop card used on the
 * Recommendations screen. Renders:
 *   • localized crop name (caller passes `label`)
 *   • fit badge (Best / Also possible / Not recommended)
 *   • beginner-friendly badge when true
 *   • support-depth badge when supplied
 *   • up to 2 short reasons
 *
 * Deliberately presentational — the screen decides which tier
 * the card belongs to.
 */

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const TIER_BADGE = {
  best: { bg: '#1b5e20', fg: '#fff',   label: 'Best fit' },
  also: { bg: '#eceff1', fg: '#37474f', label: 'Also possible' },
  not:  { bg: '#ffebee', fg: '#c62828', label: 'Low fit' },
};

export default function RecommendationCropCard({
  crop,            // raw crop id (e.g. "maize")
  label,           // localized display name
  tier = 'best',   // 'best' | 'also' | 'not'
  beginnerFriendly = false,
  supportDepth = null,  // 'full' | 'partial' | 'limited'
  reasons = [],
  selected = false,
  onSelect = null,
  t = null,
} = {}) {
  const badge = TIER_BADGE[tier] || TIER_BADGE.best;
  const supportLabel = supportDepth
    ? resolve(t, `onboardingV2.recommendations.supportDepth.${supportDepth}`, supportDepth)
    : null;

  return (
    <article
      className={`rec-card rec-card--${tier} ${selected ? 'rec-card--selected' : ''}`}
      data-crop={crop}
      data-tier={tier}
      onClick={onSelect ? () => onSelect(crop) : undefined}
      style={{
        border: `2px solid ${selected ? '#1b5e20' : '#e0e0e0'}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        background: '#fff',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'border-color 120ms ease',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{label || crop}</h3>
        <span
          className="rec-card__tier-badge"
          style={{
            fontSize: 11, fontWeight: 700,
            padding: '3px 8px', borderRadius: 999,
            background: badge.bg, color: badge.fg,
          }}
        >
          {badge.label}
        </span>
        {beginnerFriendly && (
          <span
            className="rec-card__beginner"
            style={{
              fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 999,
              background: '#e8f5e9', color: '#2e7d32',
            }}
          >
            {resolve(t, 'onboardingV2.recommendations.beginnerFriendly', 'Beginner-friendly')}
          </span>
        )}
        {supportLabel && (
          <span
            className="rec-card__support"
            style={{
              fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 999,
              background: '#fff3e0', color: '#e65100',
            }}
          >
            {supportLabel}
          </span>
        )}
      </header>
      {reasons.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#546e7a', fontSize: 13, lineHeight: 1.4 }}>
          {reasons.slice(0, 2).map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </article>
  );
}
