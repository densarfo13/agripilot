/**
 * CropStageCard — shows the lifecycle stage of the active crop cycle.
 *
 * Accepts either `cropKey` (preferred — the scorer's snake_case key,
 * resolved via getCropDisplayName so the label updates when the UI
 * language changes) or `cropName` (back-compat for callers that
 * still hand in a server-provided display string).
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';

export default function CropStageCard({ stage, cropKey, cropName }) {
  const { t, language } = useAppSettings();
  const displayName = cropKey
    ? getCropDisplayName(cropKey, language, { bilingual: 'auto' })
    : cropName;
  return (
    <section style={S.section} data-testid="crop-stage-card">
      <h3 style={S.title}>{t('actionHome.stage.title')}</h3>
      {stage ? (
        <div style={S.row}>
          <span style={S.label}>{t(`cropStage.${stage}`)}</span>
          {displayName && <span style={S.crop}>• {displayName}</span>}
        </div>
      ) : (
        <p style={S.muted}>{t('actionHome.stage.none')}</p>
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
  title: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.5rem' },
  row: { fontSize: '0.9375rem' },
  label: { fontWeight: 700 },
  crop: { color: '#9FB3C8', marginLeft: '0.375rem' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
};
