/**
 * DetectedLocationCard — confirmation banner at the top of the
 * location flow. Takes a detected location (from GPS or a prior
 * save) and offers "Use this location" / "Change".
 *
 * When detection is denied or failed, the parent should render
 * `<DetectedLocationCard detected={null} permissionState="denied" />`
 * and this component shows a clear fallback message instead of
 * disappearing silently.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { formatLocation } from '../../utils/formatLocation.js';

export default function DetectedLocationCard({
  detected,
  permissionState = 'unknown',
  onUse,
  onChange,
  detecting = false,
}) {
  const { t } = useAppSettings();
  const label = detected ? formatLocation(detected) : null;

  if (detecting) {
    return (
      <div style={S.card} data-testid="detected-location-card">
        <div style={S.title}>{t('location.detecting')}</div>
      </div>
    );
  }

  if (permissionState === 'denied') {
    return (
      <div style={S.card} data-testid="detected-location-denied">
        <div style={S.title}>{t('location.permissionDenied')}</div>
        <p style={S.body}>{t('location.permissionDeniedHint')}</p>
      </div>
    );
  }

  if (!detected || !label) {
    return (
      <div style={S.card} data-testid="detected-location-empty">
        <div style={S.title}>{t('location.noDetectedLocation')}</div>
        <p style={S.body}>{t('location.noDetectedLocationHint')}</p>
      </div>
    );
  }

  return (
    <div style={S.cardActive} data-testid="detected-location-card">
      <div style={S.titleActive}>{t('location.detectedLabel')}</div>
      <div style={S.value}>{label}</div>
      <div style={S.ctaRow}>
        <button type="button" onClick={onUse} style={S.useBtn} data-testid="detected-use">
          {t('location.useThis')}
        </button>
        <button type="button" onClick={onChange} style={S.changeBtn} data-testid="detected-change">
          {t('location.changeLocation')}
        </button>
      </div>
    </div>
  );
}

const S = {
  card: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    color: '#EAF2FF',
  },
  cardActive: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)',
    color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  title: { fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  titleActive: { fontSize: '0.75rem', color: '#22C55E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  value: { fontSize: '1rem', fontWeight: 700 },
  body: { fontSize: '0.8125rem', color: '#9FB3C8', margin: '0.25rem 0 0', lineHeight: 1.4 },
  ctaRow: { display: 'flex', gap: '0.5rem' },
  useBtn: {
    flex: 1, padding: '0.625rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
  },
  changeBtn: {
    padding: '0.625rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
};
