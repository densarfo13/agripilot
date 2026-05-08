/**
 * RegionSettingsCard — Settings surface for the user-set country
 * override.
 *
 *   <RegionSettingsCard />
 *
 * Renders:
 *   • Title + subtitle ("Region — Helps Farroway match local seasons,
 *                       crops and units")
 *   • Native <select> with the 6 known countries + "Auto-detect"
 *   • Resolved context preview (climate zone, season label,
 *                               temperature unit, top common crops)
 *   • "Reset to auto" button when override is set
 *   • Calm safety note: "We never ask for your exact location"
 *
 * Strict-rule audit
 *   • All hooks unconditional — rules-of-hooks safe.
 *   • Never throws — every callback wraps the store call.
 *   • Drop-in: import + render anywhere. Self-contained styles.
 *   • SSR-safe via the underlying useRegionPreference.
 *   • Localized via tSafe + useStrictTranslation.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { useStrictTranslation } from '../../i18n/useStrictTranslation.js';
import useRegionPreference from '../../hooks/useRegionPreference.js';
import { getAllProfiles, UNKNOWN } from '../../intelligence/region/regionProfiles.js';
import { getUnits } from '../../i18n/units.js';

// ─── Component ────────────────────────────────────────────────────

export default function RegionSettingsCard() {
  useStrictTranslation();
  const { countryCode, setCountry, clear, regionContext } = useRegionPreference();

  // Build dropdown options from the registry. Filter UNKNOWN out of
  // the picker — the "Auto-detect" sentinel below covers that case.
  const profiles = (getAllProfiles() || []).filter((p) => p && p.countryCode !== UNKNOWN.countryCode);

  // Resolved units — used for the "displays in °F / °C" preview line.
  const units = getUnits(countryCode);
  const tempLabel = units && units.temperature === 'F' ? '°F' : '°C';
  const areaLabel = units && units.area === 'acre'    ? 'acres' : 'hectares';

  function handleChange(e) {
    const next = (e && e.target && e.target.value) || '';
    if (next) setCountry(next);
  }

  function handleClear() {
    try { clear(); } catch { /* swallow */ }
  }

  // Preview lines — only shown when a country is actually picked,
  // so the empty state stays calm and unconfigured.
  const hasOverride = !!countryCode && regionContext.countryCode !== UNKNOWN.countryCode;
  const seasonText = hasOverride
    ? tSafe(regionContext.seasonLabel, regionContext.seasonLabelFallback)
    : tSafe('region.season.unknown', 'current season');
  const topCrops = (regionContext.commonCrops || []).slice(0, 5);

  return (
    <section
      style={S.card}
      data-testid="region-settings-card"
      data-country={countryCode || 'auto'}
    >
      <header style={S.head}>
        <h2 style={S.title}>
          {tSafe('region.settings.title', 'Region')}
        </h2>
        <p style={S.subtitle}>
          {tSafe('region.settings.subtitle',
            'Helps Farroway match local seasons, crops, and units.')}
        </p>
      </header>

      <label style={S.field}>
        <span style={S.label}>
          {tSafe('region.settings.countryLabel', 'Country')}
        </span>
        <select
          value={countryCode || ''}
          onChange={handleChange}
          style={S.select}
          data-testid="region-settings-select"
        >
          <option value="">
            {tSafe('region.settings.autoDetect', 'Auto-detect (recommended)')}
          </option>
          {profiles.map((p) => (
            <option key={p.countryCode} value={p.countryCode}>
              {p.countryName}
            </option>
          ))}
        </select>
      </label>

      {/* Preview block — only when a country is explicitly chosen.
          Keeps the empty state quiet so no "configure me" pressure. */}
      {hasOverride ? (
        <div style={S.preview} data-testid="region-settings-preview">
          <div style={S.previewRow}>
            <span style={S.previewLabel}>
              {tSafe('region.settings.preview.climate', 'Climate')}
            </span>
            <span style={S.previewValue}>
              {regionContext.climateZone || '—'}
            </span>
          </div>
          <div style={S.previewRow}>
            <span style={S.previewLabel}>
              {tSafe('region.settings.preview.season', 'This month')}
            </span>
            <span style={S.previewValue}>{seasonText}</span>
          </div>
          <div style={S.previewRow}>
            <span style={S.previewLabel}>
              {tSafe('region.settings.preview.units', 'Units')}
            </span>
            <span style={S.previewValue}>{tempLabel} · {areaLabel}</span>
          </div>
          {topCrops.length > 0 ? (
            <div style={S.previewRow}>
              <span style={S.previewLabel}>
                {tSafe('region.settings.preview.commonCrops', 'Common crops')}
              </span>
              <span style={S.previewValue}>
                {topCrops.map((slug) => tSafe('crop.' + slug, slug)).join(' · ')}
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleClear}
            style={S.clearBtn}
            data-testid="region-settings-clear"
          >
            {tSafe('region.settings.clear', 'Reset to auto-detect')}
          </button>
        </div>
      ) : null}

      <p style={S.safetyNote} data-testid="region-settings-safety">
        {tSafe('region.settings.privacy',
          'Region picks are kept on this device. Farroway never asks for your exact location.')}
      </p>
    </section>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const S = {
  card: {
    background:   'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)',
    border:       '1px solid rgba(255,255,255,0.07)',
    borderRadius: '18px',
    padding:      '1.05rem 1.1rem',
    display:      'flex',
    flexDirection:'column',
    gap:          '0.85rem',
    boxShadow: [
      '0 1px 0 0 rgba(255,255,255,0.04) inset',
      '0 12px 28px -8px rgba(0,0,0,0.30)',
      '0 4px 8px -2px rgba(0,0,0,0.18)',
    ].join(', '),
  },
  head: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#FFFFFF',
    letterSpacing: '-0.005em',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.45,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
  select: {
    appearance: 'none',
    fontFamily: 'inherit',
    fontSize: '0.9375rem',
    padding: '0.7rem 0.8rem',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    color: '#FFFFFF',
    minHeight: '44px',
    cursor: 'pointer',
  },
  preview: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '0.7rem 0.85rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    animation: 'farroway-fade-in 200ms ease-out both',
  },
  previewRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.7rem',
  },
  previewLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.55)',
    flexShrink: 0,
  },
  previewValue: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'right',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  clearBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    padding: '0.45rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
    marginTop: '0.2rem',
  },
  safetyNote: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
};
