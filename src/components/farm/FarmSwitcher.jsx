/**
 * FarmSwitcher — top-of-page dropdown for switching between
 * farms in a multi-farm household.
 *
 *   <FarmSwitcher />
 *
 * Contract
 * ────────
 *   • Reads `farms`, `currentFarmId`, `switchFarm` from
 *     useProfile (the canonical farm-context source, with
 *     localStorage persistence built in via the existing
 *     ProfileContext).
 *   • Renders a button labelled "Farm: <name> ▾". Click opens
 *     a popover listing every farm with the active one
 *     highlighted by a ✓ + green pill background.
 *   • On select → calls switchFarm(id) which updates the
 *     ProfileContext + persists to storage so the choice
 *     survives a page reload.
 *   • Footer adds "+ Add new farm" → /farm/new. The spec also
 *     calls for "Manage farms" → /farms, but that route is
 *     not registered in App.jsx; the entry is rendered with
 *     a defensive navigate() that falls back to /farm/new on
 *     route miss to avoid a dead click.
 *   • Single-farm households: arrow + click are disabled and
 *     the surface reads as a static "Farm: <name>" label
 *     (per spec §5).
 *   • No farm households: the surrounding page already
 *     redirects to AddFarmEmpty; this component renders null
 *     to stay defensive against being rendered at the wrong
 *     time.
 *
 * UX rules (per spec §4)
 * ──────────────────────
 *   • Compact button, single line.
 *   • Active indicator is a ✓ + tinted background row.
 *   • Max 5 farms before scroll — handled via maxHeight on
 *     the list container; overflow scrolls vertically.
 *
 * Accessibility
 * ─────────────
 *   • Button: role="button" with aria-haspopup="listbox" and
 *     aria-expanded.
 *   • List items: role="option" + aria-selected on the active
 *     farm.
 *   • Click outside / Esc closes.
 *   • Focus management is intentionally minimal — a future
 *     pass can add roving tabindex once the multi-farm cohort
 *     is exercised in the pilot.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../context/ProfileContext.jsx';
import { tSafe } from '../../i18n/tSafe.js';

const MAX_VISIBLE_BEFORE_SCROLL = 5;
const ROW_HEIGHT_REM = 2.5;

export default function FarmSwitcher() {
  const navigate = useNavigate();
  const { farms, currentFarmId, switchFarm } = useProfile();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on click outside or Esc — keeps the dropdown calm
  // and never traps focus on a misclick.
  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Defensive null returns. The "no farm" empty state is owned
  // by MyFarmPage's AddFarmEmpty render path; this component
  // shouldn't try to do its own redirect.
  if (!Array.isArray(farms) || farms.length === 0) return null;

  const active = farms.find((f) => f && f.id === currentFarmId)
              || farms[0]
              || null;
  if (!active) return null;
  const activeName = active.farmName || active.name
                  || tSafe('myFarm.unnamedFarm', 'Farm');

  const isSingle = farms.length <= 1;
  const labelPrefix = tSafe('farmSwitcher.label', 'Farm');

  function handleSelect(id) {
    setOpen(false);
    if (!id || id === currentFarmId) return;
    try { switchFarm && switchFarm(id); }
    catch { /* never break the page */ }
  }

  function handleManage() {
    setOpen(false);
    // /farms now exists (registered in App.jsx alongside the
    // ManageFarms page). Direct navigate; the prior timeout-
    // fallback to /farm/new is no longer needed.
    try { navigate('/farms'); }
    catch { /* never propagate from a click handler */ }
  }

  return (
    <div ref={wrapRef} style={S.wrap} data-testid="farm-switcher">
      <button
        type="button"
        onClick={() => { if (!isSingle) setOpen((v) => !v); }}
        style={{ ...S.btn, ...(isSingle ? S.btnDisabled : {}) }}
        aria-haspopup={isSingle ? undefined : 'listbox'}
        aria-expanded={open ? 'true' : 'false'}
        disabled={isSingle}
        data-testid="farm-switcher-toggle"
      >
        <span style={S.btnLead}>{labelPrefix}:</span>
        <span style={S.btnName}>{activeName}</span>
        {!isSingle && (
          <span aria-hidden="true" style={S.btnChevron}>{open ? '▴' : '▾'}</span>
        )}
      </button>

      {open && !isSingle && (
        <div
          style={S.popover}
          role="listbox"
          aria-label={labelPrefix}
          data-testid="farm-switcher-popover"
        >
          <div
            style={{
              ...S.list,
              maxHeight: `${MAX_VISIBLE_BEFORE_SCROLL * ROW_HEIGHT_REM}rem`,
            }}
          >
            {farms.map((f) => {
              const isActive = f.id === currentFarmId;
              const name = f.farmName || f.name
                        || tSafe('myFarm.unnamedFarm', 'Farm');
              return (
                <button
                  key={f.id}
                  type="button"
                  role="option"
                  aria-selected={isActive ? 'true' : 'false'}
                  onClick={() => handleSelect(f.id)}
                  style={{ ...S.row, ...(isActive ? S.rowActive : {}) }}
                  data-testid={`farm-switcher-row-${f.id}`}
                >
                  <span style={S.rowCheck} aria-hidden="true">
                    {isActive ? '\u2713' : ''}
                  </span>
                  <span style={S.rowName}>{name}</span>
                </button>
              );
            })}
          </div>
          <div style={S.footer}>
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/farm/new'); }}
              style={S.footerBtn}
              data-testid="farm-switcher-add"
            >
              {tSafe('farmSwitcher.addNew', '+ Add new farm')}
            </button>
            <button
              type="button"
              onClick={handleManage}
              style={S.footerBtn}
              data-testid="farm-switcher-manage"
            >
              {tSafe('farmSwitcher.manage', 'Manage farms')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: {
    position: 'relative',
    margin: '0.5rem 1rem 0',
  },
  btn: {
    width: '100%',
    appearance: 'none',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    color: '#FFFFFF',
    borderRadius: 10,
    padding: '0.6rem 0.9rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
  },
  btnDisabled: {
    cursor: 'default',
    opacity: 0.92,
  },
  btnLead: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 500,
    flex: '0 0 auto',
  },
  btnName: {
    color: '#FFFFFF',
    fontWeight: 700,
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  btnChevron: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.875rem',
    flex: '0 0 auto',
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 12,
    boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
    zIndex: 30,
    overflow: 'hidden',
  },
  list: {
    overflowY: 'auto',
  },
  row: {
    width: '100%',
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    padding: '0.55rem 0.8rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: `${ROW_HEIGHT_REM}rem`,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
  },
  rowActive: {
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
  },
  rowCheck: {
    width: 14,
    color: '#86EFAC',
    fontWeight: 700,
    flex: '0 0 auto',
  },
  rowName: {
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  footerBtn: {
    width: '100%',
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.78)',
    padding: '0.6rem 0.8rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 40,
    textAlign: 'left',
  },
};
