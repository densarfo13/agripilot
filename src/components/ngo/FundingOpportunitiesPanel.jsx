/**
 * FundingOpportunitiesPanel — NGO dashboard read-only panel
 * for the Funding Opportunities Layer.
 *
 *   <FundingOpportunitiesPanel />
 *
 * Spec contract (Funding Layer, § 8)
 *   * Active opportunities count
 *   * Matched-farmers count (best-effort — null when farms
 *     aren't passed in)
 *   * Deadlines coming soon (next 30 days)
 *   * Actions: Share with farmers, View matched farmers,
 *     Export list (CSV)
 *
 * Trust + compliance audit
 *   * Read-only — never mutates the store. Admin edits live
 *     under FundingAdmin.
 *   * "Share with farmers" deep-links to /opportunities so
 *     the operator can confirm what the farmer sees before
 *     promoting.
 *   * CSV export carries a "Sample / draft entries excluded"
 *     trailer so a download forwarded to a donor never
 *     leaks demo rows or unverified drafts.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getActiveFundingOpportunities,
  FUNDING_EVENTS,
} from '../../funding/fundingStore.js';
import { matchFundingForFarm } from '../../funding/fundingMatcher.js';
import { safeTrackEvent } from '../../lib/analytics.js';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;
const SOON_DAYS = 30;

export default function FundingOpportunitiesPanel({
  // Optional — when the host has the farms list (e.g. NGO
  // dashboard) we count distinct matched farmers. Without it
  // we just hide the metric.
  farms,
  testId = 'ngo-funding-panel',
}) {
  const opps = useMemo(() => getActiveFundingOpportunities(), []);

  const soon = useMemo(() => {
    const cutoff = Date.now() + SOON_DAYS * 24 * 60 * 60 * 1000;
    return opps.filter((o) => {
      if (!o.deadline) return false;
      const t = Date.parse(o.deadline);
      if (!Number.isFinite(t)) return false;
      return t >= Date.now() && t <= cutoff;
    });
  }, [opps]);

  // Best-effort matched-farmer count — only when the host
  // supplies farms.
  const matchedFarmers = useMemo(() => {
    if (!Array.isArray(farms) || !farms.length) return null;
    const set = new Set();
    for (const f of farms) {
      const matches = matchFundingForFarm(f, opps);
      if (matches.length > 0) {
        const id = String(f.id || f.farmerId || '');
        if (id) set.add(id);
      }
    }
    return set.size;
  }, [farms, opps]);

  function handleExport() {
    try { safeTrackEvent(FUNDING_EVENTS.EXPORT_CLICK, {}); }
    catch { /* ignore */ }
    try {
      // Filter out drafts (unverified) AND samples so a donor
      // export never carries demo data.
      const rows = opps.filter((o) => o.verified && !o.sample);
      const header = [
        'Title', 'Type', 'Country', 'Regions', 'Crops',
        'Benefit', 'Deadline', 'Source', 'Source URL', 'Contact',
      ];
      const data = rows.map((o) => [
        o.title || '',
        o.opportunityType || '',
        o.country === '*' ? 'Any' : (o.country || ''),
        Array.isArray(o.regions) ? o.regions.join('; ') : '',
        Array.isArray(o.crops)   ? o.crops.join('; ')   : '',
        o.benefit || '',
        o.deadline ? String(o.deadline).slice(0, 10) : 'Rolling',
        o.sourceName || '',
        o.sourceUrl || '',
        o.contactEmail || '',
      ]);
      const trailer = [
        [],
        ['Generated', new Date().toISOString()],
        ['Source',    'Farroway'],
        ['Note',      'Sample / draft entries excluded. Verify with each program before sharing externally.'],
      ];
      const all = [header, ...data, ...trailer];
      const csv = all
        .map((r) => r.map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `farroway-funding-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      // No-op on environments where Blob/createObjectURL
      // isn't available; the on-screen panel still shows
      // every metric.
    }
  }

  return (
    <section style={S.section} data-testid={testId}>
      <header style={S.header}>
        <div>
          <p style={S.label}>
            {tSafe('funding.ngoPanelTitle', 'Funding opportunities')}
          </p>
          <h2 style={S.title}>
            {tSafe('funding.ngoPanelLead',
              'Programs surfaced to your farmers')}
          </h2>
        </div>
        <Link
          to="/opportunities"
          style={S.cta}
          data-testid={`${testId}-share`}
        >
          {tSafe('funding.shareWithFarmers', 'Share with farmers')} →
        </Link>
      </header>

      <div style={S.metricsGrid}>
        <Metric
          icon="🎯"
          label={tSafe('funding.activeCount', 'Active opportunities')}
          value={opps.length}
        />
        <Metric
          icon="⏳"
          label={tSafe('funding.deadlinesSoon', 'Deadlines in 30 days')}
          value={soon.length}
          tone={soon.length > 0 ? 'warn' : 'neutral'}
        />
        {matchedFarmers !== null && (
          <Metric
            icon="👥"
            label={tSafe('funding.matchedFarmers', 'Matched farmers')}
            value={matchedFarmers}
            tone="good"
          />
        )}
      </div>

      {/* Compact list of deadlines coming soon */}
      {soon.length > 0 && (
        <div style={S.subsection} data-testid={`${testId}-soon`}>
          <p style={S.subLabel}>
            {tSafe('funding.deadlinesSoonLabel',
              'Closing soon — share with farmers now')}
          </p>
          <ul style={S.soonList}>
            {soon.slice(0, 5).map((o) => (
              <li key={o.id} style={S.soonItem}>
                <span style={S.soonTitle}>{o.title}</span>
                <span style={S.soonDate}>
                  {String(o.deadline).slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={S.toolbar}>
        <button
          type="button"
          onClick={handleExport}
          style={S.btnPrimary}
          data-testid={`${testId}-export`}
        >
          {tSafe('funding.exportList', 'Export list')}
        </button>
        <Link to="/admin/funding" style={S.btnGhost}
              data-testid={`${testId}-manage`}>
          {tSafe('funding.manage', 'Manage opportunities')}
        </Link>
      </div>

      <p style={S.honesty}>
        {tSafe('funding.ngoPanelHonesty',
          'Only active + verified entries surface to farmers. Sample / draft entries are excluded from the CSV export.')}
      </p>
    </section>
  );
}

function Metric({ icon, label, value, tone = 'neutral' }) {
  const colour =
      tone === 'good' ? C.lightGreen
    : tone === 'warn' ? '#FCD34D'
    :                   C.white;
  return (
    <div style={S.metric}>
      <div style={S.metricRow}>
        <span aria-hidden="true" style={S.metricIcon}>{icon}</span>
        <div style={{ ...S.metricValue, color: colour }}>
          {Number(value || 0).toLocaleString()}
        </div>
      </div>
      <div style={S.metricLabel}>{label}</div>
    </div>
  );
}

const S = {
  section: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: '0.75rem',
  },
  label: {
    margin: 0, color: C.lightGreen, fontSize: '0.6875rem',
    fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.10em',
  },
  title: {
    margin: '0.15rem 0 0', fontSize: '1.0625rem',
    fontWeight: 800, color: C.white, letterSpacing: '-0.005em',
  },
  cta: {
    display: 'inline-flex', alignItems: 'center',
    padding: '0.45rem 0.85rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.30)',
    color: C.lightGreen,
    fontSize: '0.8125rem', fontWeight: 700,
    textDecoration: 'none', flexShrink: 0,
  },
  metricsGrid: {
    display: 'grid', gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
  },
  metric: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '0.85rem',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  metricRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  metricIcon: { fontSize: '1.25rem' },
  metricValue: { fontSize: '1.5rem', fontWeight: 800,
                 lineHeight: 1.05 },
  metricLabel: { color: 'rgba(255,255,255,0.65)',
                 fontSize: '0.78rem',
                 textTransform: 'uppercase',
                 letterSpacing: '0.06em', fontWeight: 700 },

  subsection: { display: 'flex', flexDirection: 'column',
                gap: '0.4rem' },
  subLabel: { margin: 0, color: 'rgba(255,255,255,0.6)',
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em', fontWeight: 700 },
  soonList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.35rem',
  },
  soonItem: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '0.6rem',
    padding: '0.5rem 0.75rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
  },
  soonTitle: { color: C.white, fontWeight: 700,
               fontSize: '0.875rem' },
  soonDate:  { color: '#FCD34D', fontWeight: 700,
               fontSize: '0.8125rem' },

  toolbar: { display: 'flex', flexWrap: 'wrap',
             gap: '0.5rem', alignItems: 'center' },
  btnPrimary: {
    padding: '0.6rem 1rem', borderRadius: '10px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.875rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.20)',
  },
  btnGhost: {
    padding: '0.6rem 1rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none',
  },
  honesty: {
    margin: 0, color: 'rgba(255,255,255,0.55)',
    fontSize: '0.8125rem', fontStyle: 'italic',
  },
};
