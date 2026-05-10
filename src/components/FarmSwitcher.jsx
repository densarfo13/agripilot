import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { getCropLabel } from '../config/crops/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { resolveProfileCompletionRoute, routeToUrl } from '../core/multiFarm/index.js';
import { getCropLabelSafe } from '../utils/crops.js';
// Farm + Garden context switching (per spec).
//   • getMigratedGardens — first-class garden rows produced by
//     migrateLegacyFarms (gardens partitioned out of legacy
//     farms based on growing setup + size heuristics).
//   • setActiveGardenId / setActiveExperience — multiExperience
//     writers that flip the active context AND fire the
//     existing `farroway:experience_switched` event so
//     downstream surfaces (Home, Tasks, Progress, scan engines)
//     re-resolve their context without a page reload.
import { getMigratedGardens } from '../utils/migrateLegacyFarms.js';
import {
  setActiveGardenId,
  setActiveExperience,
  getActiveExperience,
  EXPERIENCE,
  SWITCH_EVENT,
} from '../store/multiExperience.js';
import { tStrict } from '../i18n/strictT.js';

/**
 * FarmSwitcher — single context switcher for **farms AND gardens**.
 *
 * Spec behaviour
 * ──────────────
 *   • Dropdown groups items under FARMS and GARDENS section
 *     headers. Either group hides cleanly when empty.
 *   • Selecting a farm flips activeExperience='farm' +
 *     setActiveFarmId via the existing switchFarm() flow.
 *   • Selecting a garden flips activeExperience='garden' +
 *     setActiveGardenId. Both writes broadcast
 *     `farroway:experience_switched`; consumers listening (Home,
 *     Tasks, Progress, scan engines) re-resolve their context.
 *   • Active label adapts to garden wording when activeExperience
 *     is 'garden' (no "crop" / "farms" leak inside a garden mode).
 *   • Subscribes to SWITCH_EVENT so a switch fired by another
 *     surface re-renders this control without a remount.
 *
 * Strict guarantees
 * ─────────────────
 *   • Never throws. Missing gardens / failed writes degrade to
 *     a no-op + surface error message in the dropdown.
 *   • No new store / no new context — uses the existing
 *     multiExperience writers + getMigratedGardens reader.
 */
export default function FarmSwitcher() {
  const { profile, activeFarms, switchFarm, refreshProfile, farmSwitching } = useProfile();
  const { isOnline } = useNetwork();
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  // Re-render on every successful experience switch so the
  // active label flips without a parent remount. The event is
  // fired by setActiveExperience / setActiveGardenId.
  const [, _setSwitchTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => _setSwitchTick((n) => n + 1);
    window.addEventListener(SWITCH_EVENT, handler);
    return () => window.removeEventListener(SWITCH_EVENT, handler);
  }, []);

  // Read gardens from the migration partition. The function
  // already returns [] on missing storage / migration not run,
  // so callers don't need a try/catch.
  const gardens = useMemo(() => {
    try { return getMigratedGardens() || []; }
    catch { return []; }
  }, []);

  const activeExperience = (() => {
    try { return getActiveExperience(); }
    catch { return null; }
  })();
  const isGardenActive = activeExperience === EXPERIENCE.GARDEN;

  const hasFarms = activeFarms && activeFarms.length > 0;
  const hasGardens    = gardens.length > 0;
  const hasMultiple = activeFarms && activeFarms.length > 1;

  // Active item — when activeExperience is garden, prefer the
  // garden whose id matches; when farm, prefer the farm. Falls
  // back to the first available record so the trigger is never
  // empty when at least one entity exists.
  const activeFarmRow = hasFarms
    ? (activeFarms.find((f) => f.isDefault) || activeFarms[0])
    : null;
  const activeGardenRow = hasGardens ? gardens[0] : null;
  const defaultFarm = isGardenActive && activeGardenRow
    ? activeGardenRow
    : (activeFarmRow || activeGardenRow || profile);

  const otherFarms = hasFarms
    ? activeFarms.filter((f) => f.id !== (activeFarmRow && activeFarmRow.id))
    : [];
  const otherGardens = hasGardens
    ? gardens.filter((g) => !isGardenActive
        || (activeGardenRow && g.id !== activeGardenRow.id))
    : [];

  async function handleSetDefault(farmId) {
    if (switching || farmSwitching) return;
    setSwitching(true);
    setError(null);
    try {
      await switchFarm(farmId);
      // Lock the active experience to 'farm' so a previous
      // garden pin doesn't re-route the Home plan back to the
      // garden surface after the next mount. setActiveExperience
      // fires SWITCH_EVENT; consumers re-resolve their context.
      try { setActiveExperience(EXPERIENCE.FARM); } catch { /* ignore */ }
      await refreshProfile();
      safeTrackEvent('farm.switched', { farmId });
      setOpen(false);
    } catch (err) {
      setError(err.message || t('farm.switchFailed'));
    } finally {
      setSwitching(false);
    }
  }

  /**
   * handleSwitchToGarden(gardenId) — local-only switch (no
   * server round-trip). multiExperience.setActiveGardenId stamps
   * the active id and setActiveExperience flips the experience
   * pin. Both fire SWITCH_EVENT; subscribed surfaces re-render.
   *
   * No-op when offline isn't a concern here — gardens are a
   * client-side partition today and writes are localStorage-only.
   */
  async function handleSwitchToGarden(gardenId) {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      const idOk  = setActiveGardenId(gardenId);
      const expOk = setActiveExperience(EXPERIENCE.GARDEN);
      if (!idOk || !expOk) throw new Error('switch_failed');
      // Best-effort profile refresh so caller surfaces that
      // depend on profile-derived state (active task list,
      // streaks) rebuild promptly.
      try { if (typeof refreshProfile === 'function') await refreshProfile(); }
      catch { /* refresh failure must not block the switch */ }
      safeTrackEvent('garden.switched', { gardenId });
      setOpen(false);
    } catch (err) {
      setError((err && err.message) || tStrict('farm.switchFailed', 'Switch failed'));
    } finally {
      setSwitching(false);
    }
  }

  function handleAddFarm() {
    setOpen(false);
    // New farm → /profile/setup?newFarm=1 (spec §8: always use the
    // standard setup route with ?newFarm=1 so the form starts clean).
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
        <span style={S.farmIcon}>{'\uD83C\uDFE1'}</span>
        <div style={S.triggerLeft}>
          <span style={S.farmName}>{defaultFarm?.farmName || defaultFarm?.location || t('farm.activeFarm')}</span>
          {/* `crop` is canonical — see canonicalizeFarmPayload in
              lib/api.js. Read only the canonical field. */}
          {defaultFarm?.crop && (
            <span style={S.farmCrop}>
              {getCropLabelSafe(defaultFarm.crop, lang)}
            </span>
          )}
          {hasFarms && (
            <span style={S.defaultBadge}>
              {hasMultiple ? t('farm.defaultFarm') : t('farm.yourFarm')}
            </span>
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
          {/* ─── FARMS section ─────────────────────────────── */}
          {otherFarms.length > 0 ? (
            <div data-testid="farm-switcher-farms-section">
              <div style={S.sectionHeader}>
                {tStrict('farm.section.farms', 'FARMS')}
              </div>
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
                  data-context-type="farm"
                >
                  <span style={S.itemName}>{farm.farmName || farm.location || t('farm.unnamed')}</span>
                  {/* `crop` is canonical (canonicalizeFarmPayload). */}
                  {farm.crop && (
                    <span style={S.itemCrop}>{getCropLabelSafe(farm.crop, lang)}</span>
                  )}
                  <span style={S.switchHint}>{t('farm.tapToSetDefault')}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* ─── GARDENS section ───────────────────────────── */}
          {otherGardens.length > 0 ? (
            <div data-testid="farm-switcher-gardens-section">
              <div style={S.sectionHeader}>
                {tStrict('farm.section.gardens', 'GARDENS')}
              </div>
              {otherGardens.map((garden) => (
                <button
                  key={garden.id}
                  onClick={() => handleSwitchToGarden(garden.id)}
                  disabled={switching}
                  style={{
                    ...S.farmItem,
                    ...(switching ? S.farmItemDisabled : {}),
                  }}
                  data-testid={`garden-item-${garden.id}`}
                  data-context-type="garden"
                >
                  <span style={S.itemName}>
                    {garden.gardenName || garden.farmName || garden.location
                      || tStrict('farm.unnamed', 'Untitled')}
                  </span>
                  {/* Garden plant label — falls through getCropLabelSafe
                      for shared crop ids; keeps localised wording. */}
                  {(garden.plant || garden.crop) && (
                    <span style={S.itemCrop}>
                      {getCropLabelSafe(garden.plant || garden.crop, lang)}
                    </span>
                  )}
                  <span style={S.switchHint}>{t('farm.tapToSwitch')}</span>
                </button>
              ))}
            </div>
          ) : null}

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
    border: '2px solid rgba(200,148,77,0.25)',
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
  defaultBadge: {
    fontSize: '0.6875rem',
    color: '#C8944D',
    fontWeight: 600,
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
  sectionHeader: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.42)',
    padding: '0.5rem 0.5rem 0.25rem',
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
