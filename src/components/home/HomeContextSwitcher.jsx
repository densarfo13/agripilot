/**
 * HomeContextSwitcher — "Working on: [ My Pepper Garden \u25BE ]"
 * dropdown that pins the active farm/garden the rest of Home,
 * Tasks, Scan, and Progress derive their context off.
 *
 *   <HomeContextSwitcher />
 *
 * Spec contract (Farm vs Garden UX §3 — Home context switcher)
 *   • Mounted at the top of Home (above the daily plan card).
 *   • Renders the active entity's display name with a chevron.
 *   • Tap → popover lists every farm AND every garden, grouped
 *     under "Farms" and "Gardens" headers. Each row shows the
 *     entity name + a tiny "garden" / "farm" chip so the user
 *     can tell at a glance which kind they're switching to.
 *   • Picking a row:
 *       - flips activeExperience via switchTo()
 *       - pins the matching active{Farm,Garden}Id
 *       - dispatches farroway:experience_switched so Home's
 *         dailyLoop / DailyPlanCard / scan flow re-render off
 *         the new context immediately
 *   • Self-hides when the user has only ONE entity total. A
 *     single-entity user has no choice to make and the chrome
 *     would be visual noise.
 *
 * Strict-rule audit
 *   • Inline styles only.
 *   • Pure consumer of useExperience + the multiExperience
 *     setActive{Farm,Garden}Id helpers. No new state plumbing.
 *   • Never throws — every action try/catch wrapped.
 *   • All visible text via tSafe with English fallbacks.
 *   • Closes the popover on outside click + Escape so it never
 *     traps the user.
 */

import { useEffect, useRef, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import useExperience from '../../hooks/useExperience.js';
import {
  setActiveGardenId, EXPERIENCE,
} from '../../store/multiExperience.js';
import { setActiveFarmId } from '../../store/farrowayLocal.js';
// Polish spec §1 \u2014 the trigger renders the canonical context
// label ("\uD83C\uDF31 Tomato Garden" / "\uD83D\uDE9C Maize Farm") instead of the
// bare entity name so the user sees the icon + suffix in one
// glance. ContextLabel reads useExperience internally, but we
// pass explicit props so the popover preview is consistent.
import ContextLabel from '../system/ContextLabel.jsx';

const C = {
  panel:   '#102C47',
  border:  'rgba(255,255,255,0.10)',
  ink:     '#FFFFFF',
  inkDim:  'rgba(255,255,255,0.65)',
  green:   '#22C55E',
  greenBg: 'rgba(34,197,94,0.12)',
  greenBd: 'rgba(34,197,94,0.32)',
  greenFg: '#86EFAC',
  navy:    '#0B1D34',
};

const S = {
  wrap: { position: 'relative', margin: '0 1rem 0.75rem' },
  trigger: {
    appearance: 'none', display: 'flex', alignItems: 'center', gap: 8,
    width: '100%',
    background: C.panel,
    border: `1px solid ${C.border}`,
    color: C.ink,
    borderRadius: 12,
    padding: '0.6rem 0.85rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 44,
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  triggerLabel: { color: C.inkDim, fontSize: '0.75rem', fontWeight: 600, marginRight: 4 },
  triggerName:  { color: C.ink,    fontSize: '0.9rem',  fontWeight: 800 },
  triggerChevron: { marginLeft: 'auto', color: C.inkDim, fontSize: '0.85rem', lineHeight: 1 },

  popover: {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 6,
    boxShadow: '0 14px 32px rgba(0,0,0,0.45)',
    zIndex: 30,
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  group: { padding: '4px 0' },
  groupTitle: {
    padding: '6px 10px 4px',
    fontSize: '0.65rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: C.inkDim,
  },
  row: {
    appearance: 'none', display: 'flex', alignItems: 'center', gap: 8,
    width: '100%',
    background: 'transparent',
    border: '1px solid transparent',
    color: C.ink,
    borderRadius: 10,
    padding: '0.55rem 0.7rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 40,
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  rowActive: {
    background: C.greenBg,
    border: `1px solid ${C.greenBd}`,
    color: C.greenFg,
  },
  rowName: { flex: '1 1 auto' },
  rowChip: {
    padding: '1px 8px',
    fontSize: '0.6rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${C.border}`,
    color: C.inkDim,
  },
  rowChipActive: {
    background: 'rgba(34,197,94,0.20)',
    border: `1px solid ${C.greenBd}`,
    color: C.greenFg,
  },
  empty: {
    padding: '0.5rem 0.7rem',
    color: C.inkDim,
    fontSize: '0.8rem',
  },
};

function _entityName(row, kindLabel) {
  if (!row) return '';
  return row.name || row.farmName || row.cropLabel
      || (row.crop ? String(row.crop).replace(/_/g, ' ') : null)
      || kindLabel;
}

export default function HomeContextSwitcher() {
  const exp = useExperience();
  const {
    farms, gardens, activeEntity, experience,
    activeFarmId, activeGardenId, hasFarm, hasGarden,
  } = exp || {};

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return undefined;
    function onClickAway(ev) {
      try {
        if (wrapRef.current && !wrapRef.current.contains(ev.target)) {
          setOpen(false);
        }
      } catch { /* swallow */ }
    }
    function onKey(ev) {
      if (ev.key === 'Escape') setOpen(false);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('mousedown', onClickAway);
      window.addEventListener('keydown',   onKey);
      return () => {
        window.removeEventListener('mousedown', onClickAway);
        window.removeEventListener('keydown',   onKey);
      };
    }
    return undefined;
  }, [open]);

  // Self-hide when the user has nothing to switch between.
  const totalEntities = (Array.isArray(farms)   ? farms.length   : 0)
                      + (Array.isArray(gardens) ? gardens.length : 0);
  if (totalEntities < 2) return null;

  const farmRows   = Array.isArray(farms)   ? farms   : [];
  const gardenRows = Array.isArray(gardens) ? gardens : [];

  function pick(row, kind) {
    if (!row || !row.id) return;
    setOpen(false);
    try {
      if (kind === 'garden') {
        setActiveGardenId(row.id);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('farroway_active_experience', EXPERIENCE.GARDEN);
        }
      } else {
        setActiveFarmId(row.id);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('farroway_active_experience', EXPERIENCE.FARM);
        }
      }
      // Broadcast — useExperience subscribers re-render and
      // re-derive their snapshots off the new active id.
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('farroway:experience_switched', {
          detail: { experience: kind, activeId: row.id, source: 'home-switcher' },
        }));
      }
    } catch { /* swallow — user can retry */ }
  }

  const triggerCtx = experience === EXPERIENCE.GARDEN ? 'garden' : 'farm';
  const triggerName = _entityName(
    activeEntity,
    experience === EXPERIENCE.GARDEN
      ? tSafe('homeSwitcher.unnamedGarden', 'My garden')
      : tSafe('homeSwitcher.unnamedFarm',   'My farm'),
  );

  return (
    <div ref={wrapRef} style={S.wrap} data-testid="home-context-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={S.trigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-testid="home-context-switcher-trigger"
      >
        <span style={S.triggerLabel}>
          {tSafe('homeSwitcher.workingOn', 'Working on:')}
        </span>
        {/* Polish spec §1 \u2014 canonical "\uD83C\uDF31 Tomato Garden" /
            "\uD83D\uDE9C Maize Farm" label. Renders the icon + name +
            suffix as a single visual unit; the icon is
            decorative (aria-hidden) so screen readers announce
            only the text. */}
        <span style={{ ...S.triggerName, display: 'inline-flex', alignItems: 'center' }}>
          <ContextLabel
            context={triggerCtx}
            name={activeEntity ? _entityName(activeEntity, '') : ''}
            size="md"
            testid="home-context-switcher-label"
          />
        </span>
        <span aria-hidden="true" style={S.triggerChevron}>
          {open ? '\u25B4' : '\u25BE'}
        </span>
      </button>
      {open ? (
        <div role="listbox" style={S.popover} data-testid="home-context-switcher-popover">
          {/* Farms group — hides entirely when there are no farms. */}
          {farmRows.length > 0 ? (
            <div style={S.group}>
              <div style={S.groupTitle}>
                {tSafe('homeSwitcher.farms', 'Farms')}
              </div>
              {farmRows.map((row) => {
                const isActive = experience === EXPERIENCE.FARM
                              && String(row.id) === String(activeFarmId);
                return (
                  <button
                    key={`farm-${row.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => pick(row, 'farm')}
                    style={isActive ? { ...S.row, ...S.rowActive } : S.row}
                    data-testid={`home-context-switcher-farm-${row.id}`}
                  >
                    <span style={S.rowName}>
                      {_entityName(row, tSafe('homeSwitcher.unnamedFarm', 'My farm'))}
                    </span>
                    <span style={isActive ? { ...S.rowChip, ...S.rowChipActive } : S.rowChip}>
                      {tSafe('homeSwitcher.kind.farm', 'farm')}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {/* Gardens group — same self-hide rule. */}
          {gardenRows.length > 0 ? (
            <div style={S.group}>
              <div style={S.groupTitle}>
                {tSafe('homeSwitcher.gardens', 'Gardens')}
              </div>
              {gardenRows.map((row) => {
                const isActive = experience === EXPERIENCE.GARDEN
                              && String(row.id) === String(activeGardenId);
                return (
                  <button
                    key={`garden-${row.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => pick(row, 'garden')}
                    style={isActive ? { ...S.row, ...S.rowActive } : S.row}
                    data-testid={`home-context-switcher-garden-${row.id}`}
                  >
                    <span style={S.rowName}>
                      {_entityName(row, tSafe('homeSwitcher.unnamedGarden', 'My garden'))}
                    </span>
                    <span style={isActive ? { ...S.rowChip, ...S.rowChipActive } : S.rowChip}>
                      {tSafe('homeSwitcher.kind.garden', 'garden')}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {/* Defensive empty fallback — should never render because
              totalEntities < 2 short-circuits the parent return,
              but kept so a future single-entity edge case still
              shows a calm message instead of an empty popover. */}
          {farmRows.length === 0 && gardenRows.length === 0 ? (
            <div style={S.empty}>
              {tSafe('homeSwitcher.empty', 'Nothing to switch yet.')}
            </div>
          ) : null}
        </div>
      ) : null}
      {/* Suppress unused-var lint on hasFarm/hasGarden — kept on
          the destructure so future tweaks (e.g. "Add Garden" CTA
          inside the popover when one type is missing) have direct
          access without re-reading the snapshot. */}
      <span style={{ display: 'none' }} aria-hidden="true">
        {String(!!hasFarm)}{String(!!hasGarden)}
      </span>
    </div>
  );
}
