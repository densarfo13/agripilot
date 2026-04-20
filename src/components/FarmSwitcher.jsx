import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { resolveProfileCompletionRoute, routeToUrl } from '../core/multiFarm/index.js';

/**
 * FarmSwitcher — always visible. Shows active farm, allows switching.
 * Single farm: shows farm label + "Add New Farm".
 * Multiple farms: dropdown with sorted list + switch actions.
 * Handles missing/archived default gracefully.
 */
export default function FarmSwitcher() {
  const { profile, activeFarms, switchFarm, refreshProfile, farmSwitching } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  const hasFarms = activeFarms && activeFarms.length > 0;
  const hasMultiple = activeFarms && activeFarms.length > 1;
  const defaultFarm = hasFarms
    ? (activeFarms.find((f) => f.isDefault) || activeFarms[0])
    : profile;
  const otherFarms = hasMultiple
    ? activeFarms.filter((f) => f.id !== defaultFarm?.id)
    : [];

  async function handleSetDefault(farmId) {
    if (switching || farmSwitching) return;
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
    // Existing multi-farm user adding a second farm → legacy setup
    // with ?newFarm=1 is the intended destination. The helper still
    // centralizes the decision so future rerouting lives in one place.
    const dest = resolveProfileCompletionRoute({
      profile, farms: activeFarms, reason: 'new_farm',
    });
    navigate(routeToUrl(dest));
  }

  return (
    <div style={S.wrapper}>
      <button
        onClick={() => setOpen(!open)}
        style={S.trigger}
        aria-expanded={open}
        data-testid="farm-switcher-btn"
      >
        <span style={S.farmIcon}>{'\uD83C\uDFE1'}</span>
        <div style={S.triggerLeft}>
          <span style={S.farmName}>{defaultFarm?.farmName || defaultFarm?.location || t('farm.activeFarm')}</span>
          {defaultFarm?.cropType && (
            <span style={S.farmCrop}>{defaultFarm.cropType}</span>
          )}
        </div>
        <div style={S.triggerRight}>
          {hasMultiple && (
            <span style={S.farmCount}>{activeFarms.length} {t('farm.farms')}</span>
          )}
          <span style={S.arrow}>{open ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>

      {open && (
        <div style={S.dropdown} data-testid="farm-switcher-dropdown">
          {otherFarms.map((farm) => (
            <button
              key={farm.id}
              onClick={() => handleSetDefault(farm.id)}
              disabled={switching || farmSwitching || !isOnline}
              style={{
                ...S.farmItem,
                ...((switching || farmSwitching) ? S.farmItemDisabled : {}),
              }}
              data-testid={`farm-item-${farm.id}`}
            >
              <span style={S.itemName}>{farm.farmName || farm.location || t('farm.unnamed')}</span>
              {farm.cropType && <span style={S.itemCrop}>{farm.cropType}</span>}
              <span style={S.switchHint}>{t('farm.tapToSwitch')}</span>
            </button>
          ))}

          <button onClick={handleAddFarm} style={S.addFarmBtn} data-testid="add-farm-btn">
            + {t('farm.addNew')}
          </button>

          {!isOnline && hasMultiple && (
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
    gap: '0.75rem',
    background: '#1B2330',
    border: '2px solid rgba(34,197,94,0.25)',
    borderRadius: '14px',
    padding: '0.75rem 1rem',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: 600,
    width: '100%',
    WebkitTapHighlightColor: 'transparent',
    minHeight: '56px',
  },
  farmIcon: {
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  triggerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    overflow: 'hidden',
    textAlign: 'left',
    flex: 1,
  },
  triggerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  farmName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '1rem',
    fontWeight: 700,
  },
  farmCrop: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 500,
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
    minHeight: '48px',
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
  switchHint: {
    fontSize: '0.75rem',
    color: '#86EFAC',
    fontWeight: 600,
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
    minHeight: '48px',
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
