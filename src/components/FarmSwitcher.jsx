import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';

/**
 * FarmSwitcher — shows all active farms, highlights default.
 * Only visible when user has more than one active farm.
 * Tapping a non-default farm sets it as default.
 * Low-literacy friendly: farm name + crop + location, one-tap switch.
 */
export default function FarmSwitcher() {
  const { profile, activeFarms, switchFarm, refreshProfile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  // Only show if user has more than 1 active farm
  if (!activeFarms || activeFarms.length <= 1) return null;

  const defaultFarm = activeFarms.find((f) => f.isDefault) || profile;
  const otherFarms = activeFarms.filter((f) => f.id !== defaultFarm?.id);

  async function handleSetDefault(farmId) {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      await switchFarm(farmId);
      await refreshProfile();
      safeTrackEvent('farm.switched', { farmId });
      setOpen(false);
    } catch (err) {
      setError(err.message || t('farm.switchFailed'));
    } finally {
      setSwitching(false);
    }
  }

  function handleAddFarm() {
    setOpen(false);
    navigate('/profile/setup?newFarm=1');
  }

  return (
    <div style={S.wrapper}>
      <button
        onClick={() => setOpen(!open)}
        style={S.trigger}
        aria-expanded={open}
        data-testid="farm-switcher-btn"
      >
        <div style={S.triggerLeft}>
          <span style={S.defaultBadge}>{t('farm.defaultFarm')}</span>
          <span style={S.farmName}>{defaultFarm?.farmName || defaultFarm?.location || t('farm.activeFarm')}</span>
        </div>
        <div style={S.triggerRight}>
          <span style={S.farmCount}>{activeFarms.length} {t('farm.farms')}</span>
          <span style={S.arrow}>{open ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>

      {open && (
        <div style={S.dropdown} data-testid="farm-switcher-dropdown">
          {otherFarms.map((farm) => (
            <button
              key={farm.id}
              onClick={() => handleSetDefault(farm.id)}
              disabled={switching || !isOnline}
              style={{
                ...S.farmItem,
                ...(switching ? S.farmItemDisabled : {}),
              }}
              data-testid={`farm-item-${farm.id}`}
            >
              <span style={S.itemName}>{farm.farmName || farm.location || t('farm.unnamed')}</span>
              <span style={S.itemCrop}>{farm.cropType || ''}</span>
              {farm.location && <span style={S.itemLocation}>{farm.location}</span>}
              <span style={S.setDefaultHint}>{t('farm.tapToSetDefault')}</span>
            </button>
          ))}

          <button onClick={handleAddFarm} style={S.addFarmBtn} data-testid="add-farm-btn">
            + {t('farm.addNew')}
          </button>

          {!isOnline && (
            <div style={S.offlineHint}>{t('farm.offlineSwitch')}</div>
          )}
          {error && <div style={S.errorMsg}>{error}</div>}
        </div>
      )}
    </div>
  );
}

const S = {
  wrapper: {
    position: 'relative',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    padding: '0.625rem 1rem',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: 600,
    width: '100%',
    justifyContent: 'space-between',
    WebkitTapHighlightColor: 'transparent',
  },
  triggerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    overflow: 'hidden',
    textAlign: 'left',
  },
  triggerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  defaultBadge: {
    fontSize: '0.6875rem',
    color: '#86EFAC',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  farmName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.9375rem',
  },
  farmCount: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    whiteSpace: 'nowrap',
  },
  arrow: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 0,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '0.375rem',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    padding: '0.375rem',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  farmItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    borderRadius: '8px',
    padding: '0.75rem',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#fff',
    WebkitTapHighlightColor: 'transparent',
  },
  farmItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  itemName: {
    fontSize: '0.9375rem',
    fontWeight: 600,
  },
  itemCrop: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
  },
  itemLocation: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.4)',
  },
  setDefaultHint: {
    fontSize: '0.6875rem',
    color: '#86EFAC',
    marginTop: '0.25rem',
  },
  addFarmBtn: {
    background: 'transparent',
    border: '1px dashed rgba(255,255,255,0.2)',
    borderRadius: '8px',
    padding: '0.625rem',
    color: '#86EFAC',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    textAlign: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  offlineHint: {
    fontSize: '0.75rem',
    color: '#FDE68A',
    textAlign: 'center',
    padding: '0.375rem',
  },
  errorMsg: {
    fontSize: '0.8125rem',
    color: '#FCA5A5',
    background: 'rgba(239,68,68,0.1)',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    textAlign: 'center',
  },
};
