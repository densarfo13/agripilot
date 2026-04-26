import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ALL_CROPS, OTHER_CROP, CATEGORY_LABELS, getCropByCode, getCropLabel, getCropIcon, parseCropValue, buildOtherCropValue, getCropLabelSafe } from '../utils/crops.js';
import { recommendCrops } from '../utils/cropRecommendations.js';
import { getLocalizedCropList } from '../data/cropRegionCatalog.js';
import { fetchCropSuggestions, saveLastCrop, getLastCrop } from '../utils/cropSuggestionCache.js';

/**
 * CropSelect — searchable crop dropdown with structured "Other" support
 * and rule-based crop recommendations.
 *
 * Props:
 *   value            — stored crop value (e.g. "MAIZE", "OTHER:Teff", or legacy "maize")
 *   onChange          — (newValue: string) => void
 *   countryCode?     — "KE" | "TZ"
 *   region?          — farmer region string
 *   season?          — season name
 *   farmSize?        — farm size in acres
 *   soilType?        — soil type string
 *   landType?        — land type string
 *   required?        — HTML required attribute
 *   placeholder?     — placeholder text
 *   label?           — field label
 *   optional?        — show "(optional)" hint
 *   style?           — wrapper style override
 *   className?       — wrapper class
 *   disabled?        — disable the input
 */

export default function CropSelect({
  value,
  onChange,
  countryCode,
  region,
  season,
  farmSize,
  soilType,
  landType,
  required = false,
  placeholder = 'Search and select a crop',
  label,
  optional = false,
  style,
  className,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [learnedCrops, setLearnedCrops] = useState([]);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const parsed = parseCropValue(value);

  // ── Fetch learned crop suggestions (cached, non-blocking) ──
  useEffect(() => {
    let cancelled = false;
    fetchCropSuggestions(countryCode).then(crops => {
      if (!cancelled) setLearnedCrops(crops);
    });
    return () => { cancelled = true; };
  }, [countryCode]);

  // ── Recommendations from the engine (now includes learned data) ──
  const lastCrop = useMemo(() => getLastCrop(), []);
  const recResult = useMemo(() => {
    return recommendCrops({
      country: countryCode,
      region,
      season,
      farmSize: farmSize ? Number(farmSize) : undefined,
      soilType,
      landType,
      learnedCrops,
      lastCropCode: lastCrop?.code || null,
    });
  }, [countryCode, region, season, farmSize, soilType, landType, learnedCrops, lastCrop]);

  const recommended = recResult.recommendations;
  const hasRecommendations = recResult.hasContext && recommended.length > 0;

  // Local crop codes for "Popular in your area" grouping in dropdown
  const localCropCodes = useMemo(() => {
    if (!countryCode) return new Set();
    const { local } = getLocalizedCropList(countryCode);
    return new Set(local.map(e => e.code));
  }, [countryCode]);

  // ── Build learned custom crops as selectable entries ────
  const learnedCustomEntries = useMemo(() => {
    const staticCodes = new Set(ALL_CROPS.map(c => c.code));
    return learnedCrops
      .filter(lc => lc.cropCode?.toUpperCase().startsWith('OTHER:') && !staticCodes.has(lc.cropCode))
      .map(lc => ({
        code: lc.cropCode,
        name: lc.cropName || lc.cropCode.slice(6),
        category: 'other',
        learned: true,
        useCount: lc.useCount,
      }));
  }, [learnedCrops]);

  // ── Search / filter ────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const allWithLearned = [...ALL_CROPS, ...learnedCustomEntries];
    if (!q) return allWithLearned;
    return allWithLearned.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (CATEGORY_LABELS[c.category] || '').toLowerCase().includes(q)
    );
  }, [search, learnedCustomEntries]);

  // "Other" entry with descriptive hint for the dropdown
  const OTHER_DISPLAY = { ...OTHER_CROP, displayName: 'Other (type your crop)' };

  // Build the rendered list: filtered crops + OTHER
  const displayList = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const otherMatch = 'other'.includes(q) || 'type your crop'.includes(q);
      return otherMatch ? [...filtered, OTHER_DISPLAY] : filtered;
    }
    return [...ALL_CROPS, ...learnedCustomEntries, OTHER_DISPLAY];
  }, [search, filtered, learnedCustomEntries]);

  // ── Close on outside click ─────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Scroll highlighted into view ───────────────────────
  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[highlightIdx];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx, open]);

  // ── Selection handler ──────────────────────────────────
  const selectCrop = (code) => {
    if (code === 'OTHER') {
      onChange('OTHER');
    } else {
      onChange(code);
      saveLastCrop(code); // Remember last selection for next time
    }
    setSearch('');
    setOpen(false);
  };

  // ── Keyboard navigation ────────────────────────────────
  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowDown') { setHighlightIdx(i => Math.min(i + 1, displayList.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setHighlightIdx(i => Math.max(i - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter') {
      if (displayList[highlightIdx]) selectCrop(displayList[highlightIdx].code);
      e.preventDefault();
    }
    else if (e.key === 'Escape') setOpen(false);
  };

  // ── Display text ───────────────────────────────────────
  const displayText = value
    ? (parsed.isCustomCrop
        ? (parsed.customCropName || 'Other')
        : getCropLabelSafe(value))
    : '';
  const displayIcon = value ? getCropIcon(value) : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }} className={className}>
      {label && (
        <label style={S.label}>
          {label} {optional && <span style={{ color: '#71717A', fontWeight: 400 }}>optional</span>}
        </label>
      )}

      {/* ── "Other" selected → show custom name input ── */}
      {parsed.isCustomCrop && value !== '' ? (
        <div style={S.otherRow}>
          <div style={S.otherTag} onClick={() => { onChange(''); setOpen(true); }}>
            🌱 Other ×
          </div>
          <input
            style={S.otherInput}
            value={parsed.customCropName || ''}
            onChange={(e) => {
              const built = buildOtherCropValue(e.target.value);
              onChange(built);
              if (e.target.value.trim().length >= 2) saveLastCrop(built);
            }}
            placeholder="Enter your crop"
            required={required}
            disabled={disabled}
            autoFocus
          />
        </div>
      ) : (
        /* ── Normal: closed or searching ── */
        <div
          style={{ ...S.inputWrap, borderColor: open ? '#22C55E' : '#243041', opacity: disabled ? 0.6 : 1 }}
          onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
        >
          {!open && displayIcon && <span style={{ fontSize: '1rem', lineHeight: 1 }}>{displayIcon}</span>}
          {open ? (
            <input
              ref={inputRef}
              style={S.searchInput}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setHighlightIdx(0); }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus
              disabled={disabled}
            />
          ) : (
            <span style={{ flex: 1, color: displayText ? '#FFFFFF' : '#71717A', fontSize: '0.9rem' }}>
              {displayText || placeholder}
            </span>
          )}
          <span style={{ color: '#71717A', fontSize: '0.7rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
          {required && (
            <input type="text" value={value || ''} required
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
              tabIndex={-1} onChange={() => {}} />
          )}
        </div>
      )}

      {/* ── Dropdown ── */}
      {open && (
        <div style={S.dropdown}>
          {/* Recommendations section */}
          {!search.trim() && hasRecommendations && (
            <>
              <div style={S.sectionHeader}>Recommended for your land</div>
              {recommended.map(r => {
                const isSelected = value?.toUpperCase() === r.code;
                return (
                  <div
                    key={`rec-${r.code}`}
                    style={{ ...S.option, background: isSelected ? 'rgba(34,197,94,0.15)' : undefined }}
                    onClick={() => selectCrop(r.code)}
                    onMouseEnter={() => setHighlightIdx(-1)}
                    title={r.reason}
                  >
                    <span style={S.optionIcon}>{getCropIcon(r.code)}</span>
                    <span style={S.optionName}>{r.name}</span>
                    <span style={S.optionReason}>{r.reason.split(';')[0]}</span>
                    {isSelected && <span style={S.check}>✓</span>}
                  </div>
                );
              })}
              <div style={S.divider} />
              <div style={S.sectionHeader}>All crops</div>
            </>
          )}
          {!search.trim() && !hasRecommendations && countryCode && localCropCodes.size > 0 && (
            <>
              <div style={S.sectionHeader}>Popular in your area</div>
              {ALL_CROPS.filter(c => localCropCodes.has(c.code)).slice(0, 10).map(c => {
                const isSelected = value?.toUpperCase() === c.code;
                return (
                  <div
                    key={`local-${c.code}`}
                    style={{ ...S.option, background: isSelected ? 'rgba(34,197,94,0.15)' : undefined }}
                    onClick={() => selectCrop(c.code)}
                    onMouseEnter={() => setHighlightIdx(-1)}
                  >
                    <span style={S.optionIcon}>{getCropIcon(c.code)}</span>
                    <span style={S.optionName}>{c.name}</span>
                    <span style={S.localBadge}>Local</span>
                    {isSelected && <span style={S.check}>✓</span>}
                  </div>
                );
              })}
              <div style={S.divider} />
              <div style={S.sectionHeader}>All crops</div>
            </>
          )}
          {!search.trim() && !hasRecommendations && countryCode && localCropCodes.size === 0 && (
            <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.72rem', color: '#71717A', fontStyle: 'italic' }}>
              Add land details to get crop suggestions
            </div>
          )}

          {/* Scrollable list */}
          <div ref={listRef} style={S.listScroll}>
            {displayList.length === 0 ? (
              <div style={S.noResults}>
                No crops match "{search}" — select <strong>Other</strong> below
                <div style={{ ...S.option, marginTop: '0.5rem', background: 'rgba(34,197,94,0.1)' }} onClick={() => selectCrop('OTHER')}>
                  <span style={S.optionIcon}>🌱</span>
                  <span style={S.optionName}>Other (type your crop)</span>
                </div>
              </div>
            ) : (
              displayList.map((c, i) => {
                const isSelected = value?.toUpperCase() === c.code;
                return (
                  <div
                    key={c.code}
                    style={{
                      ...S.option,
                      background: i === highlightIdx ? '#243041' : isSelected ? 'rgba(34,197,94,0.15)' : undefined,
                    }}
                    onClick={() => selectCrop(c.code)}
                    onMouseEnter={() => setHighlightIdx(i)}
                  >
                    <span style={S.optionIcon}>{getCropIcon(c.code)}</span>
                    <span style={S.optionName}>{c.displayName || c.name}</span>
                    {c.learned && <span style={S.learnedBadge}>Popular</span>}
                    {!c.learned && c.category !== 'other' && (
                      <span style={S.optionCategory}>{CATEGORY_LABELS[c.category] || c.category}</span>
                    )}
                    {isSelected && <span style={S.check}>✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lightweight inline crop display — icon + label.
 */
export function CropBadge({ value, style: extra }) {
  if (!value) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', ...extra }}>
      <span>{getCropIcon(value)}</span>
      <span>{getCropLabelSafe(value)}</span>
    </span>
  );
}

// ── Styles ───────────────────────────────────────────────────
const S = {
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#A1A1AA', marginBottom: '0.3rem' },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.6rem 0.75rem', background: '#1E293B', border: '1px solid #243041',
    borderRadius: '6px', cursor: 'pointer', minHeight: '44px', position: 'relative',
  },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', padding: 0 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
    background: '#162033', border: '1px solid #243041', borderRadius: '8px',
    marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    maxHeight: '320px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  listScroll: { overflowY: 'auto', maxHeight: '280px' },
  sectionHeader: {
    padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.72rem', fontWeight: 700,
    color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  divider: { height: '1px', background: '#243041', margin: '0.25rem 0' },
  option: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.6rem 0.75rem', cursor: 'pointer', transition: 'background 0.1s', fontSize: '0.88rem',
    minHeight: '44px',
  },
  optionIcon: { fontSize: '1rem', width: '1.2rem', textAlign: 'center' },
  optionName: { flex: 1, color: '#FFFFFF' },
  optionCategory: { fontSize: '0.7rem', color: '#71717A' },
  optionReason: { fontSize: '0.68rem', color: '#A1A1AA', fontStyle: 'italic', maxWidth: '45%', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  check: { color: '#22C55E', fontWeight: 700, fontSize: '0.9rem' },
  learnedBadge: {
    fontSize: '0.65rem', color: '#3B82F6', background: 'rgba(59,130,246,0.1)',
    borderRadius: '3px', padding: '0.1rem 0.35rem', fontWeight: 600, whiteSpace: 'nowrap',
  },
  localBadge: {
    fontSize: '0.65rem', color: '#22C55E', background: 'rgba(34,197,94,0.1)',
    borderRadius: '3px', padding: '0.1rem 0.35rem', fontWeight: 600, whiteSpace: 'nowrap',
  },
  noResults: { padding: '0.75rem', color: '#A1A1AA', fontSize: '0.85rem', textAlign: 'center' },
  otherRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.4rem 0.5rem', background: '#1E293B', border: '1px solid #243041', borderRadius: '6px',
  },
  otherTag: {
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    background: 'rgba(34,197,94,0.15)', color: '#22C55E', borderRadius: '4px',
    padding: '0.2rem 0.5rem', fontSize: '0.78rem', fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid rgba(34,197,94,0.3)',
  },
  otherInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', padding: '0.2rem 0', minHeight: '44px' },
};
