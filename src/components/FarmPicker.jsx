import { useProfile } from '../context/ProfileContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { getCropLabel } from '../config/crops/index.js';
import { getCropLabelSafe } from '../utils/crops.js';

/**
 * FarmPicker — simple farm selection step for multi-farm users.
 * Shows tap-friendly cards for each active farm.
 * Used as first step in QuickUpdateFlow when multiple farms exist.
 */
export default function FarmPicker({ onSelect, onCancel }) {
  const { activeFarms } = useProfile();
  const { t, lang } = useTranslation();

  return (
    <div style={S.container} data-testid="farm-picker">
      {/* Header */}
      <div style={S.header}>
        <button onClick={onCancel} style={S.closeBtn} aria-label="Close">&times;</button>
        <span style={S.title}>{t('farm.whichFarm')}</span>
        <div style={{ width: 44 }} />
      </div>

      {/* Farm cards */}
      <div style={S.farmList}>
        {activeFarms.map((farm) => (
          <button
            key={farm.id}
            onClick={() => onSelect(farm)}
            style={S.farmCard}
            data-testid={`pick-farm-${farm.id}`}
          >
            <div style={S.farmRow}>
              <span style={S.farmIcon}>{farm.isDefault ? '\u2B50' : '\uD83C\uDF3E'}</span>
              <div style={S.farmInfo}>
                <span style={S.farmNameText}>
                  {farm.farmName || farm.location || t('farm.unnamed')}
                </span>
                {(farm.crop || farm.cropType) && (
                  <span style={S.farmCrop}>
                    {getCropLabelSafe(farm.crop || farm.cropType, lang)}
                  </span>
                )}
                {farm.location && <span style={S.farmLoc}>{farm.location}</span>}
              </div>
              {farm.isDefault && (
                <span style={S.defaultTag}>{t('farm.default')}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const S = {
  container: {
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    background: '#0F172A',
    borderRadius: '16px',
    padding: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  closeBtn: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid #243041',
    borderRadius: '10px',
    color: '#FFFFFF',
    fontSize: '1.25rem',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minHeight: '44px',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  farmList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  farmCard: {
    display: 'block',
    width: '100%',
    padding: '1rem',
    background: '#162033',
    border: '2px solid #243041',
    borderRadius: '14px',
    cursor: 'pointer',
    color: '#FFFFFF',
    textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
    minHeight: '60px',
  },
  farmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  farmIcon: {
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  farmInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    flex: 1,
    overflow: 'hidden',
  },
  farmNameText: {
    fontSize: '1rem',
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  farmCrop: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
  },
  farmLoc: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.4)',
  },
  defaultTag: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#86EFAC',
    background: 'rgba(134,239,172,0.1)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
