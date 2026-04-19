/**
 * LocationSelector — searchable region picker for the buyer browse
 * page. Renders preferred regions first, the rest after.
 *
 * Props:
 *   value               { country, stateCode? } | null
 *   preferredRegions    Array<{ country, stateCode?, label? }>
 *   allRegions          Array<{ country, stateCode?, label }> (optional
 *                       fallback set; if not supplied we build from the
 *                       internal US_STATES list + preferred countries)
 *   onChange(next)      selected region changed
 *   onReset()           reset to preferredRegions[0]
 *   onExpand()          user asked to broaden search beyond preferred
 *
 * UX goals from the spec:
 *   - pre-filled from buyer preference
 *   - editable with one tap
 *   - searchable
 *   - "reset to default" + "expand search" explicit actions
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { COUNTRY_REGIONS, COUNTRIES } from '../../utils/locationData.js';

// Light built-in list so the selector works out of the box even when
// the caller doesn't pass `allRegions`. Country-only entries first,
// then per-country states/regions drawn from COUNTRY_REGIONS.
function buildDefaultAllRegions() {
  const out = [];
  const countryNameByCode = Object.fromEntries(
    (COUNTRIES || []).map((c) => [c.code, c.name]),
  );
  for (const code of ['US', 'GH', 'NG', 'KE']) {
    const name = countryNameByCode[code] || code;
    out.push({ country: code, stateCode: null, label: `${name} (all)` });
    const regions = COUNTRY_REGIONS?.[code] || [];
    for (const r of regions) {
      out.push({
        country: code,
        stateCode: r.code,
        label: `${r.name}, ${name}`,
      });
    }
  }
  return out;
}

function regionKey(r) {
  if (!r) return '';
  return `${String(r.country || '').toUpperCase()}:${r.stateCode ? String(r.stateCode).toUpperCase() : ''}`;
}

function regionLabel(r, t) {
  if (!r) return t('market.location.none') || 'Any location';
  if (r.label) return r.label;
  if (r.stateCode) return `${r.stateCode}, ${r.country}`;
  return String(r.country || '').toUpperCase();
}

export default function LocationSelector({
  value,
  preferredRegions = [],
  allRegions,
  onChange,
  onReset,
  onExpand,
}) {
  const { t } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef(null);

  const effectiveAll = useMemo(
    () => (Array.isArray(allRegions) && allRegions.length ? allRegions : buildDefaultAllRegions()),
    [allRegions],
  );

  // Sort: preferred first (in order), then everything else alphabetically.
  const preferredKeys = useMemo(
    () => new Set((preferredRegions || []).map(regionKey)),
    [preferredRegions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const preferred = (preferredRegions || [])
      .map((r) => ({ ...r, _preferred: true }));
    const others = effectiveAll
      .filter((r) => !preferredKeys.has(regionKey(r)))
      .map((r) => ({ ...r, _preferred: false }));
    const combined = [...preferred, ...others];
    if (!q) return combined;
    return combined.filter((r) => {
      const hay = `${r.label || ''} ${r.country || ''} ${r.stateCode || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [preferredRegions, effectiveAll, preferredKeys, query]);

  // Close popover on outside click / escape.
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(r) {
    onChange?.(r);
    setOpen(false);
    setQuery('');
  }

  return (
    <div style={S.wrap} ref={popoverRef} data-testid="location-selector">
      <button
        type="button"
        style={S.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="location-trigger"
      >
        <span style={S.triggerIcon}>{'\uD83D\uDCCD'}</span>
        <span style={S.triggerText}>
          {value ? regionLabel(value, t) : (t('market.location.any') || 'Any location')}
        </span>
        <span style={S.triggerCaret}>▾</span>
      </button>

      {open && (
        <div style={S.popover} role="listbox" data-testid="location-popover">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('market.location.searchPlaceholder') || 'Search regions…'}
            style={S.search}
            data-testid="location-search"
          />

          <div style={S.actions}>
            {preferredRegions?.length > 0 && (
              <button
                type="button"
                style={S.actionBtn}
                onClick={() => { onReset?.(); setOpen(false); }}
                data-testid="location-reset"
              >
                {t('market.location.reset') || 'Reset to default region'}
              </button>
            )}
            {onExpand && (
              <button
                type="button"
                style={S.actionBtnGhost}
                onClick={() => { onExpand?.(); setOpen(false); }}
                data-testid="location-expand"
              >
                {t('market.location.expand') || 'Expand to more regions'}
              </button>
            )}
          </div>

          {(preferredRegions?.length > 0 && !query) && (
            <GroupHeader label={t('market.location.preferred') || 'Your regions'} />
          )}

          <ul style={S.list}>
            {filtered.map((r, idx) => {
              const key = regionKey(r);
              const isSelected = value && regionKey(value) === key;
              // Insert "other regions" divider once after the preferred.
              const showDivider =
                !query
                && idx > 0
                && !r._preferred
                && filtered[idx - 1]?._preferred;
              return (
                <li key={`${key}:${idx}`}>
                  {showDivider && (
                    <GroupHeader label={t('market.location.other') || 'Other regions'} />
                  )}
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    style={{ ...S.row, ...(isSelected ? S.rowSelected : null) }}
                    data-testid={`location-row-${r.country}-${r.stateCode || 'ALL'}`}
                  >
                    <span>{regionLabel(r, t)}</span>
                    {r._preferred && (
                      <span style={S.pillPreferred}>{t('market.location.preferredPill') || 'Preferred'}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li style={S.empty}>{t('market.location.noResults') || 'No regions match.'}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function GroupHeader({ label }) {
  return (
    <div style={S.group}>
      <span>{label}</span>
    </div>
  );
}

export { regionKey, regionLabel };

const S = {
  wrap: { position: 'relative', display: 'flex', flexDirection: 'column' },
  trigger: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer', width: '100%', textAlign: 'left',
  },
  triggerIcon: { fontSize: '1rem' },
  triggerText: { flex: 1, fontSize: '0.9375rem' },
  triggerCaret: { color: '#9FB3C8' },
  popover: {
    position: 'absolute', zIndex: 30, top: 'calc(100% + 6px)', left: 0, right: 0,
    background: '#0B1D34',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '0.625rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    maxHeight: '360px', overflowY: 'auto',
    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
  },
  search: {
    padding: '0.5rem 0.625rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.9375rem',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  actionBtn: {
    padding: '0.375rem 0.625rem', borderRadius: '8px',
    border: '1px solid rgba(34,197,94,0.28)', background: 'rgba(34,197,94,0.12)',
    color: '#22C55E', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
  },
  actionBtnGhost: {
    padding: '0.375rem 0.625rem', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
  },
  group: {
    padding: '0.375rem 0.25rem',
    fontSize: '0.6875rem', color: '#9FB3C8', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  row: {
    display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.5rem 0.625rem', borderRadius: '8px',
    border: '1px solid transparent', background: 'transparent',
    color: '#EAF2FF', fontSize: '0.875rem', textAlign: 'left', cursor: 'pointer', minHeight: '40px',
  },
  rowSelected: {
    background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.28)',
    color: '#22C55E', fontWeight: 700,
  },
  pillPreferred: {
    fontSize: '0.625rem', fontWeight: 700, color: '#22C55E',
    padding: '0.125rem 0.375rem', borderRadius: '999px',
    border: '1px solid rgba(34,197,94,0.28)', background: 'rgba(34,197,94,0.08)',
  },
  empty: { padding: '0.5rem', color: '#9FB3C8', fontSize: '0.8125rem' },
};
