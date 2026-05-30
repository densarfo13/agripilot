/**
 * MyPlants.jsx — My Plants home grid.
 *
 *   <Route path="/my-plants" element={<MyPlants />} />
 *
 * What this is
 * ────────────
 *   Renders the user's managed plants grouped by the 8
 *   PLANT_CATEGORIES (flower · vegetable · fruit · herb ·
 *   houseplant · crop · tree · shrub). For each section we
 *   show the icon, label, count, average health, and an
 *   alerts badge — all derived from the runtime-tier
 *   registrySummary().
 *
 *   The page reads its managed-plant list from localStorage
 *   (UI-layer read, which is permitted; the wave-5 single-
 *   writer rule blocks engines from writing storage — not the
 *   UI). When no plants are stored, an empty-state CTA points
 *   the user to /scan as the canonical add path.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe (guards typeof window).
 *   • Read-only against localStorage; engines stay write-free.
 *   • tSafe envelopes for all copy.
 *   • No camera-error wording; no first-load camera prompt.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import { registrySummary } from '../runtime/plants/index';
// Gap-fix blocker 3 — managed-plant persistence routes through
// one facade so quota / corrupt-JSON / private-mode all degrade
// silently the same way across MyPlants / PlantProfile / ScanPage.
import { loadManagedPlants } from '../runtime/data/managedPlants.js';
// Real Plant Image System — render plant thumbnails in section
// rows (and in the search result list when active).
import PlantImage from '../components/plants/PlantImage.jsx';

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '24px 16px 96px',
    maxWidth: 720,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { margin: '0 0 6px', fontSize: 24, fontWeight: 800,
            letterSpacing: '-0.01em' },
  subtitle: { margin: '0 0 18px', fontSize: 14, color: '#667085',
              lineHeight: 1.5 },
  // Wave-27 — honest device-persistence hint.
  devicePersistHint: {
    display: 'inline-block',
    background: '#FFF9F0',
    border: '1px solid rgba(200,148,77,0.32)',
    color: '#8B6914',
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 999,
    marginBottom: 12,
    cursor: 'help',
  },
  topRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 18,
  },
  topStat: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  topStatLabel: { fontSize: 11, fontWeight: 700, color: '#94A3B8',
                  textTransform: 'uppercase', letterSpacing: '0.06em' },
  topStatValue: { fontSize: 22, fontWeight: 800, color: '#1F2933',
                  marginTop: 4 },
  sections: { display: 'flex', flexDirection: 'column', gap: 10 },
  section: (count) => ({
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '14px 14px',
    opacity: count === 0 ? 0.55 : 1,
  }),
  sectionRow: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  icon: { fontSize: 28, lineHeight: 1, flexShrink: 0 },
  sectionMeta: { flex: 1, minWidth: 0 },
  sectionLabel: { fontSize: 16, fontWeight: 700, color: '#1F2933' },
  sectionSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  badge: (kind) => ({
    fontSize: 11, fontWeight: 800, padding: '3px 8px',
    borderRadius: 999,
    background: kind === 'alert' ? 'rgba(239,68,68,0.10)'
              : kind === 'good'  ? 'rgba(16,185,129,0.10)'
              : 'rgba(148,163,184,0.10)',
    color:      kind === 'alert' ? '#991B1B'
              : kind === 'good'  ? '#047857'
              : '#475569',
    border: '1px solid rgba(31,41,51,0.06)',
  }),
  emptyCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 14,
    padding: '20px 18px',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: 800, color: '#1F2933',
                margin: '0 0 6px' },
  emptyBody: { fontSize: 14, color: '#64748B', margin: '0 0 14px',
               lineHeight: 1.55 },
  cta: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '10px 18px', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default function MyPlants() {
  const navigate = useNavigate();
  const managedPlants = useMemo(() => loadManagedPlants(), []);
  const summary = useMemo(
    () => registrySummary(managedPlants), [managedPlants]);

  // Search — Phase 5 spec. Filters managed plants by common
  // name OR scientific name OR category, case-insensitive.
  const [query, setQuery] = useState('');
  const searchResults = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (q.length < 2) return null;
    return (managedPlants || [])
      .filter((p) => p && typeof p === 'object')
      .filter((p) => {
        const n = String(p.commonName || '').toLowerCase();
        const s = String(p.scientificName || '').toLowerCase();
        const c = String(p.category || '').toLowerCase();
        return n.includes(q) || s.includes(q) || c.includes(q);
      })
      .slice(0, 25);
  }, [query, managedPlants]);

  const isEmpty = summary.totalCount === 0;

  return (
    <main style={STYLES.page} data-testid="my-plants-page">
      <h1 style={STYLES.header}>
        {tSafe('myPlants.title', 'My Plants')}
      </h1>
      <p style={STYLES.subtitle}>
        {tSafe('myPlants.subtitle',
          'Every plant you scan, pick, or add lives here with tasks, '
          + 'health, and history.')}
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tSafe('myPlants.searchPlaceholder',
          'Search by name, scientific name, or category')}
        data-testid="my-plants-search"
        style={{
          width: '100%', padding: '10px 12px', fontSize: 14,
          border: '1px solid rgba(31,41,51,0.12)', borderRadius: 10,
          background: '#FFFFFF', marginBottom: 14, boxSizing: 'border-box',
          fontFamily: 'inherit', color: '#1F2933',
        }}
      />

      {searchResults != null ? (
        <div data-testid="my-plants-search-results"
          style={{ marginBottom: 14 }}>
          {searchResults.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8',
                        fontStyle: 'italic', margin: 0 }}>
              {tSafe('myPlants.noResults',
                'No plants match — try a different term.')}
            </p>
          ) : searchResults.map((p) => (
            <button key={p.id} type="button"
              onClick={() => navigate('/my-plants/' + encodeURIComponent(p.id))}
              data-testid={`my-plants-search-result-${p.id}`}
              style={{
                appearance: 'none', width: '100%',
                textAlign: 'left', cursor: 'pointer',
                background: '#FFFFFF',
                border: '1px solid rgba(31,41,51,0.08)',
                borderRadius: 10, padding: '10px 12px',
                marginBottom: 6, fontFamily: 'inherit',
                fontSize: 13, color: '#1F2933',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
              <PlantImage
                plantId={(p.commonName || '').toLowerCase().replace(/\s+/g, '_')}
                plantLibraryImage={p.imageUrl}
                scanImage={p.thumbnailUrl}
                alt={p.commonName || ''}
                size="thumb"
                testid={`my-plants-result-image-${p.id}`}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{p.commonName || tSafe('myPlants.unnamed', 'Unnamed')}</strong>
                {p.scientificName ? ' · ' + p.scientificName : ''}
                {' · ' + (p.category || '')}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {/* Wave-27 CPO retention fix — honest persistence hint. MyPlants
          today is localStorage-only (loadManagedPlants reads from
          farroway_managed_plants). Without this hint, users assume
          cloud sync and lose plants on cache clear. Surfacing the
          truth turns the "I lost my plants" ticket into an expected
          behavior. Pure UI add — no engine change. */}
      {summary.totalCount > 0 ? (
        <div
          style={STYLES.devicePersistHint}
          data-testid="my-plants-device-persist-hint"
          title={tSafe(
            'myPlants.savedOnThisDevice.tooltip',
            'Plants are saved on this device. Avoid clearing browser data — we are working on cloud sync.'
          )}
        >
          {tSafe(
            'myPlants.savedOnThisDevice',
            'Saved on this device'
          )}
        </div>
      ) : null}

      <div style={STYLES.topRow}>
        <div style={STYLES.topStat} data-testid="my-plants-stat-total">
          <div style={STYLES.topStatLabel}>
            {tSafe('myPlants.total', 'Total plants')}
          </div>
          <div style={STYLES.topStatValue}>{summary.totalCount}</div>
        </div>
        <div style={STYLES.topStat} data-testid="my-plants-stat-health">
          <div style={STYLES.topStatLabel}>
            {tSafe('myPlants.avgHealth', 'Avg health')}
          </div>
          <div style={STYLES.topStatValue}>
            {summary.avgHealthOverall == null ? '—' : summary.avgHealthOverall}
          </div>
        </div>
        <div style={STYLES.topStat} data-testid="my-plants-stat-alerts">
          <div style={STYLES.topStatLabel}>
            {tSafe('myPlants.alerts', 'Alerts')}
          </div>
          <div style={STYLES.topStatValue}>{summary.totalAlerts}</div>
        </div>
      </div>

      {isEmpty ? (
        <div style={STYLES.emptyCard} data-testid="my-plants-empty">
          <h2 style={STYLES.emptyTitle}>
            {tSafe('myPlants.empty.title', 'No plants yet')}
          </h2>
          <p style={STYLES.emptyBody}>
            {tSafe('myPlants.empty.body',
              'Scan a plant and it will appear here with tasks, '
              + 'a health score, and reminders.')}
          </p>
          <button
            type="button"
            style={STYLES.cta}
            onClick={() => navigate('/scan')}
            data-testid="my-plants-empty-cta"
          >
            {tSafe('myPlants.empty.cta', 'Scan to add a plant')}
          </button>
        </div>
      ) : (
        <div style={STYLES.sections}>
          {summary.sections.map((s) => (
            <div key={s.category}
              style={STYLES.section(s.count)}
              data-testid={`my-plants-section-${s.category}`}
            >
              <div style={STYLES.sectionRow}>
                <div style={STYLES.icon} aria-hidden="true">{s.icon}</div>
                <div style={STYLES.sectionMeta}>
                  <div style={STYLES.sectionLabel}>
                    {tSafe(s.labelKey, s.labelDefault)}
                  </div>
                  <div style={STYLES.sectionSub}>
                    {s.count} {s.count === 1
                      ? tSafe('myPlants.plant', 'plant')
                      : tSafe('myPlants.plants', 'plants')}
                    {s.avgHealth == null ? '' : ' · ' + tSafe(
                      'myPlants.health', 'health') + ' ' + s.avgHealth}
                  </div>
                </div>
                {s.alerts > 0 ? (
                  <div style={STYLES.badge('alert')}
                    data-testid={`my-plants-alerts-${s.category}`}>
                    {s.alerts} {tSafe('myPlants.alertLabel', 'alert')}
                    {s.alerts === 1 ? '' : 's'}
                  </div>
                ) : s.count > 0 ? (
                  <div style={STYLES.badge('good')}>
                    {tSafe('myPlants.allWell', 'All well')}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
