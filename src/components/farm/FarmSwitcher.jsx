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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../context/ProfileContext.jsx';
import { tSafe } from '../../i18n/tSafe.js';
import { Sprout } from '../icons/lucide.jsx';
// Multi-Farm Switcher §6 — recent-farms ordering. Pure helper
// module; no React state churn here.
import { markFarmAccessed, getRecentFarmIds } from '../../store/recentFarms.js';

const MAX_VISIBLE_BEFORE_SCROLL = 5;
const ROW_HEIGHT_REM = 2.5;
// Multi-Farm Switcher §3 — search input surfaces only when the
// user has more than this many farms. Below the threshold the
// dropdown stays clean (search would be overkill for ≤5 rows).
const SEARCH_THRESHOLD = 5;
// Multi-Farm Switcher §6 — quick-switch row caps at this many
// recent farms so the rail never crowds out the full list.
const RECENT_FARMS_LIMIT = 3;

export default function FarmSwitcher() {
  const navigate = useNavigate();
  const { farms, currentFarmId, switchFarm } = useProfile();
  const [open, setOpen] = useState(false);
  // Multi-Farm Switcher §3 — search input state. Initialised
  // empty; only renders when farms.length > SEARCH_THRESHOLD.
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  // Multi-Farm Switcher §5 + §6 — bump the active farm to the
  // top of the recent-farms list whenever it changes. Pure
  // side effect; markFarmAccessed is idempotent within a 60s
  // window so a re-render doesn't churn the ordering.
  useEffect(() => {
    if (currentFarmId) {
      try { markFarmAccessed(currentFarmId); }
      catch { /* swallow — analytics-shape; never block render */ }
    }
  }, [currentFarmId]);

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

  // ─── Hook-order fix (May 2026) ───
  // Both useMemo blocks were previously after the
  // `if (!Array.isArray(farms) || farms.length === 0) return null`
  // gate, which trips rules-of-hooks. Hoisted ABOVE every early
  // return so the hook count is stable across the empty-farms
  // transition. Both memos are pure derivations whose results
  // are simply discarded on the no-farms branch.
  const safeFarms = Array.isArray(farms) ? farms : [];
  const showSearch = safeFarms.length > SEARCH_THRESHOLD;
  const filteredFarms = useMemo(() => {
    if (!showSearch || !query.trim()) return safeFarms;
    const q = query.trim().toLowerCase();
    return safeFarms.filter((f) => {
      const name = String(f.farmName || f.name || '').toLowerCase();
      const region = String(f.region || f.state || '').toLowerCase();
      return name.includes(q) || region.includes(q);
    });
  }, [safeFarms, query, showSearch]);

  const recentRows = useMemo(() => {
    if (showSearch && query.trim()) return [];
    let ids = [];
    try { ids = getRecentFarmIds({ exclude: currentFarmId, limit: RECENT_FARMS_LIMIT }); }
    catch { ids = []; }
    if (!ids.length) return [];
    const byId = new Map(safeFarms.map((f) => [f.id, f]));
    const rows = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (row) rows.push(row);
    }
    return rows;
  }, [safeFarms, currentFarmId, query, showSearch]);

  // Defensive null returns — moved BELOW every hook. The "no
  // farm" empty state is owned by MyFarmPage's AddFarmEmpty
  // render path; this component shouldn't try to do its own
  // redirect.
  if (safeFarms.length === 0) return null;

  const active = safeFarms.find((f) => f && f.id === currentFarmId)
              || safeFarms[0]
              || null;
  if (!active) return null;
  const activeName = active.farmName || active.name
                  || tSafe('myFarm.unnamedFarm', 'Farm');

  const isSingle = safeFarms.length <= 1;
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
        {/* Sprout icon — small green accent that identifies this
            row as the farm-context selector. Hidden from a11y so
            it doesn't compete with the visible label text. */}
        <span aria-hidden="true" style={S.btnIcon}>
          <Sprout size={16} />
        </span>
        <span style={S.btnLead}>{labelPrefix}:</span>
        <span style={S.btnName}>{activeName}</span>
        {!isSingle && (
          <span aria-hidden="true" style={S.btnChevron}>{open ? '\u25B4' : '\u25BE'}</span>
        )}
      </button>

      {open && !isSingle && (
        <div
          style={S.popover}
          role="listbox"
          aria-label={labelPrefix}
          data-testid="farm-switcher-popover"
        >
          {/* Multi-Farm Switcher §3 — search input. Surfaces only
              when the user has > SEARCH_THRESHOLD farms. The
              filter applies to name + region (substring,
              case-insensitive). Empty query renders all rows. */}
          {showSearch ? (
            <div style={S.searchRow}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tSafe('farmSwitcher.searchPlaceholder',
                  'Search farms\u2026')}
                style={S.searchInput}
                data-testid="farm-switcher-search"
                autoFocus
              />
            </div>
          ) : null}

          {/* Multi-Farm Switcher §6 — recent farms quick-switch
              rail. Up to RECENT_FARMS_LIMIT rows newest-first,
              excluding the active farm. Hidden when search is
              active so the user only sees one list at a time. */}
          {recentRows.length > 0 ? (
            <div style={S.section} data-testid="farm-switcher-recent">
              <span style={S.sectionLabel}>
                {tSafe('farmSwitcher.recent', 'Recent')}
              </span>
              {recentRows.map((f) => {
                const name = f.farmName || f.name
                          || tSafe('myFarm.unnamedFarm', 'Farm');
                return (
                  <button
                    key={`recent-${f.id}`}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => handleSelect(f.id)}
                    style={S.row}
                    data-testid={`farm-switcher-recent-${f.id}`}
                  >
                    <span style={S.rowCheck} aria-hidden="true" />
                    <span style={S.rowName}>{name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div
            style={{
              ...S.list,
              maxHeight: `${MAX_VISIBLE_BEFORE_SCROLL * ROW_HEIGHT_REM}rem`,
            }}
          >
            {filteredFarms.length === 0 ? (
              <div style={S.emptySearch} data-testid="farm-switcher-empty-search">
                {tSafe('farmSwitcher.noMatch', 'No matching farms')}
              </div>
            ) : null}
            {filteredFarms.map((f) => {
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
                  {/* Multi-Farm Switcher §2 — explicit [ACTIVE]
                      badge alongside the existing ✓ glyph. Two
                      visual cues for the same state: the glyph
                      reads at a glance, the badge confirms in
                      text — better for low-literacy + high-
                      density (10+ farms) cohorts. */}
                  {isActive ? (
                    <span style={S.activeBadge} aria-hidden="true">
                      {tSafe('farmSwitcher.activeBadge', 'ACTIVE')}
                    </span>
                  ) : null}
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
    // Green-accent border (My Farm polish, Apr 2026): subtle
    // emerald edge that ties the selector to the farm-control
    // theme without shouting. Same green as the primary CTA.
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: '0.7rem 0.9rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
    boxShadow: '0 4px 12px rgba(34,197,94,0.06)',
  },
  btnDisabled: {
    cursor: 'default',
    opacity: 0.92,
  },
  // Leading sprout icon — small green accent on the left.
  btnIcon: {
    color: '#22C55E',
    display: 'inline-flex',
    alignItems: 'center',
    flex: '0 0 auto',
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
  // Multi-Farm Switcher §2 — explicit "[ACTIVE]" badge that sits
  // to the right of the active row's name. Tiny green pill —
  // reads as text confirmation alongside the ✓ glyph on the
  // left. Hidden on inactive rows.
  activeBadge: {
    flex: '0 0 auto',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    padding: '2px 6px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.20)',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.45)',
    marginLeft: 8,
  },
  // Multi-Farm Switcher §3 — search input row. Sits at the very
  // top of the popover when farms.length > SEARCH_THRESHOLD.
  searchRow: {
    padding: '8px 10px 6px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  searchInput: {
    width: '100%',
    appearance: 'none',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
  },
  // Multi-Farm Switcher §6 — recent-farms quick-switch rail.
  // Visually demarcated from the full list below by a soft
  // bottom border + a label eyebrow.
  section: {
    display: 'flex',
    flexDirection: 'column',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  sectionLabel: {
    padding: '4px 12px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
  },
  // Multi-Farm Switcher §3 — empty-search state inside the list.
  emptySearch: {
    padding: '14px 12px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    fontStyle: 'italic',
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
