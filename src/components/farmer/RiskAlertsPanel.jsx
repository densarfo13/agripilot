/**
 * RiskAlertsPanel — amber list of concerns the Today feed surfaced.
 *
 * If `weatherAlerts` are passed, they render in a distinct blue-tinted
 * sub-section above the cycle/issue risks so farmers can tell weather-
 * driven guidance apart from cycle-health concerns.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function RiskAlertsPanel({ alerts = [], weatherAlerts = [], weatherBadge = null }) {
  const { t } = useAppSettings();
  // Deduplicate weather alerts out of the generic list so they're not
  // shown twice when todayEngine already concatenated them.
  const weatherSet = new Set(weatherAlerts);
  const staticAlerts = alerts.filter((a) => !weatherSet.has(a));
  const hasAny = staticAlerts.length > 0 || weatherAlerts.length > 0;

  return (
    <section style={S.section} data-testid="risk-alerts-panel">
      <h3 style={S.title}>{t('actionHome.risks.title')}</h3>

      {weatherBadge && (
        <div
          data-testid="weather-badge"
          style={{ ...S.badge, borderColor: weatherBadge.color, color: weatherBadge.color }}
        >
          {t(weatherBadge.labelKey) || weatherBadge.labelKey}
        </div>
      )}

      {weatherAlerts.length > 0 && (
        <ul style={S.list} data-testid="weather-alerts">
          {weatherAlerts.map((alert, i) => (
            <li key={`w-${i}`} style={S.item}>
              <span style={{ ...S.dot, background: '#3B82F6' }} />
              <span>{alert}</span>
            </li>
          ))}
        </ul>
      )}

      {staticAlerts.length > 0 && (
        <ul style={S.list}>
          {staticAlerts.map((alert, i) => (
            <li key={`s-${i}`} style={S.item}>
              <span style={S.dot} />
              <span>{alert}</span>
            </li>
          ))}
        </ul>
      )}

      {!hasAny && <p style={S.muted}>{t('actionHome.risks.none')}</p>}
    </section>
  );
}

const S = {
  section: {
    padding: '1rem', borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#EAF2FF',
  },
  title: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#F59E0B' },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.625rem',
    borderRadius: '999px',
    border: '1px solid',
    fontSize: '0.75rem',
    fontWeight: 600,
    margin: '0 0 0.5rem',
  },
  list: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  item: { display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem', padding: '0.375rem 0' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
};
