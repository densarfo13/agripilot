/**
 * RiskAlertsPanel — amber list of concerns the Today feed surfaced.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function RiskAlertsPanel({ alerts = [] }) {
  const { t } = useAppSettings();
  return (
    <section style={S.section} data-testid="risk-alerts-panel">
      <h3 style={S.title}>{t('actionHome.risks.title')}</h3>
      {alerts.length === 0 ? (
        <p style={S.muted}>{t('actionHome.risks.none')}</p>
      ) : (
        <ul style={S.list}>
          {alerts.map((alert, i) => (
            <li key={i} style={S.item}>
              <span style={S.dot} />
              <span>{alert}</span>
            </li>
          ))}
        </ul>
      )}
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
  list: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  item: { display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem', padding: '0.375rem 0' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
};
