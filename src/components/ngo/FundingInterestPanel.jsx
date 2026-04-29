/**
 * FundingInterestPanel — NGO dashboard panel showing the
 * outcome side of the Funding Apply + Request Help flow.
 *
 *   <FundingInterestPanel />
 *
 * Spec contract (Funding Apply, § 8)
 *   * Counts: total interests / assistance requested /
 *     applied
 *   * By-opportunity rollup
 *   * Farmer contact ONLY for ASSISTANCE_REQUESTED rows —
 *     other statuses surface counts without phone/name
 *   * Actions: Mark contacted, Export CSV
 *
 * Privacy guardrail (per spec § 8 + § 12)
 *   "Do NOT expose unnecessary farmer data broadly."
 *
 *   We surface farmer name + phone for ASSISTANCE_REQUESTED
 *   rows ONLY. APPLIED / INTERESTED rows show only the
 *   opportunity + status — never the contact info. CSV
 *   export carries assistance contacts only; the other
 *   statuses appear as anonymous counts.
 */

import React, { useMemo, useState } from 'react';
import {
  getFundingInterests, interestSummary,
  updateFundingInterest, INTEREST_STATUS, INTEREST_EVENTS,
} from '../../funding/fundingApplicationStore.js';
import { getFundingOpportunities }
  from '../../funding/fundingStore.js';
import { safeTrackEvent } from '../../lib/analytics.js';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

export default function FundingInterestPanel({
  testId = 'ngo-funding-interests',
}) {
  // tick lets us refresh after an admin marks contacted
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const summary       = useMemo(() => interestSummary(),    [tick]);
  const allInterests  = useMemo(() => getFundingInterests(), [tick]);
  const opportunities = useMemo(() => {
    const byId = new Map();
    for (const o of getFundingOpportunities()) byId.set(o.id, o);
    return byId;
  }, [tick]);

  // Assistance-requested rows are the only ones that surface
  // contact info on screen.
  const assistanceRows = useMemo(
    () => allInterests.filter(
      (i) => i.status === INTEREST_STATUS.ASSISTANCE_REQUESTED,
    ),
    [allInterests],
  );

  function handleMarkContacted(id) {
    if (!id) return;
    updateFundingInterest(id, { status: INTEREST_STATUS.CONTACTED });
    refresh();
  }

  function handleExportCsv() {
    try { safeTrackEvent('FUNDING_INTEREST_EXPORT', {}); }
    catch { /* ignore */ }
    try {
      // CSV carries assistance-contacts only — APPLIED /
      // INTERESTED rows are aggregated as counts in the
      // trailer so a forwarded download never leaks a
      // farmer's contact for a status they didn't opt into.
      const header = [
        'Opportunity', 'Status', 'Farmer name', 'Phone',
        'Message', 'Created', 'Updated',
      ];
      const data = assistanceRows.map((i) => {
        const o = opportunities.get(i.opportunityId);
        return [
          (o && o.title) || i.opportunityId,
          i.status,
          i.farmerName || '',
          i.farmerPhone || '',
          i.message || '',
          i.createdAt || '',
          i.updatedAt || '',
        ];
      });
      const trailer = [
        [],
        ['Counts (no contact info)'],
        ['Interested',           summary.interested           || 0],
        ['Assistance requested', summary.assistanceRequested  || 0],
        ['Applied (self-report)',summary.applied              || 0],
        ['Contacted',            summary.contacted            || 0],
        [],
        ['Generated', new Date().toISOString()],
        ['Source',    'Farroway'],
        ['Note',      'Only ASSISTANCE_REQUESTED rows include farmer contact. Other statuses are counts only — never share other farmers\' contact details externally.'],
      ];
      const csv = [header, ...data, ...trailer]
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
      a.download = `farroway-funding-interests-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch { /* ignore */ }
  }

  // Per-opportunity rollup, sorted by total desc so the
  // operator sees their highest-traction programs first.
  const byOpp = useMemo(() => {
    const rows = (summary.byOpportunity || []).map((b) => ({
      ...b,
      title: (opportunities.get(b.opportunityId) || {}).title
             || b.opportunityId,
    }));
    rows.sort((a, b) => b.total - a.total);
    return rows.slice(0, 6);
  }, [summary, opportunities]);

  return (
    <section style={S.section} data-testid={testId}>
      <header style={S.header}>
        <div>
          <p style={S.label}>
            {tSafe('funding.applicationInterest', 'Application interest')}
          </p>
          <h2 style={S.title}>
            {tSafe('funding.applicationInterestLead',
              'How farmers are engaging with funding programs')}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          style={S.cta}
          data-testid={`${testId}-export`}
        >
          {tSafe('funding.exportInterests', 'Export CSV')}
        </button>
      </header>

      <div style={S.metricsGrid}>
        <Metric
          icon="🌱"
          label={tSafe('funding.interested', 'Interested')}
          value={summary.interested}
        />
        <Metric
          icon="🤝"
          label={tSafe('funding.assistanceRequested', 'Help requested')}
          value={summary.assistanceRequested}
          tone={summary.assistanceRequested > 0 ? 'warn' : 'neutral'}
        />
        <Metric
          icon="✅"
          label={tSafe('funding.applied', 'Applied (self-report)')}
          value={summary.applied}
          tone="good"
        />
        <Metric
          icon="📞"
          label={tSafe('funding.contacted', 'Contacted')}
          value={summary.contacted}
        />
      </div>

      {/* By opportunity */}
      {byOpp.length > 0 && (
        <div style={S.subsection} data-testid={`${testId}-by-opp`}>
          <p style={S.subLabel}>
            {tSafe('funding.byOpportunity', 'By opportunity')}
          </p>
          <ul style={S.list}>
            {byOpp.map((b) => (
              <li key={b.opportunityId} style={S.row}>
                <span style={S.rowTitle}>{b.title}</span>
                <span style={S.rowCounts}>
                  {b.interested} interested · {b.assistanceRequested} help
                  · {b.applied} applied
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assistance contact list — gated to ASSISTANCE_REQUESTED only. */}
      {assistanceRows.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyText}>
            {tSafe('funding.noAssistanceRequests',
              'No assistance requests yet. Farmers who tap Request Help on an opportunity will appear here.')}
          </p>
        </div>
      ) : (
        <div style={S.subsection} data-testid={`${testId}-assistance`}>
          <p style={S.subLabel}>
            {tSafe('funding.assistanceRequestList',
              'Assistance requests — farmer contact')}
          </p>
          <ul style={S.list}>
            {assistanceRows.slice(0, 12).map((i) => {
              const o = opportunities.get(i.opportunityId);
              return (
                <li key={i.id} style={S.assistRow}>
                  <div style={S.assistTop}>
                    <span style={S.assistOpp}>
                      {(o && o.title) || i.opportunityId}
                    </span>
                    <span style={S.assistDate}>
                      {String(i.createdAt || '').slice(0, 10)}
                    </span>
                  </div>
                  <div style={S.assistContact}>
                    <span>{i.farmerName || tSafe('funding.unnamedFarmer', 'Farmer')}</span>
                    {i.farmerPhone && (
                      <a href={`tel:${i.farmerPhone}`}
                         style={S.assistPhone}>
                        📞 {i.farmerPhone}
                      </a>
                    )}
                  </div>
                  {i.message && (
                    <p style={S.assistMessage}>{i.message}</p>
                  )}
                  <div style={S.assistActions}>
                    <button
                      type="button"
                      onClick={() => handleMarkContacted(i.id)}
                      style={S.assistBtn}
                      data-testid={`${testId}-mark-contacted-${i.id}`}
                    >
                      {tSafe('funding.markContacted', 'Mark contacted')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p style={S.honesty}>
        {tSafe('funding.interestPanelHonesty',
          'Farmer contact info is shown only for explicit assistance requests. CSV export reflects the same rule — other statuses are aggregated counts only.')}
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
    fontWeight: 800, color: C.white,
    letterSpacing: '-0.005em',
  },
  cta: {
    padding: '0.55rem 0.95rem', borderRadius: '10px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '0.875rem', fontWeight: 800,
    cursor: 'pointer', flexShrink: 0,
    boxShadow: '0 6px 18px rgba(34,197,94,0.20)',
  },
  metricsGrid: {
    display: 'grid', gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
  },
  metric: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.2rem',
  },
  metricRow: { display: 'flex', alignItems: 'center', gap: '0.45rem' },
  metricIcon: { fontSize: '1.25rem' },
  metricValue: { fontSize: '1.4rem', fontWeight: 800,
                 lineHeight: 1.05 },
  metricLabel: { color: 'rgba(255,255,255,0.6)',
                 fontSize: '0.78rem',
                 textTransform: 'uppercase',
                 letterSpacing: '0.06em', fontWeight: 700 },

  subsection: { display: 'flex', flexDirection: 'column',
                gap: '0.4rem' },
  subLabel:   { margin: 0, color: 'rgba(255,255,255,0.6)',
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em', fontWeight: 700 },
  list: { listStyle: 'none', padding: 0, margin: 0,
          display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  row: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
    padding: '0.5rem 0.75rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
  },
  rowTitle:  { color: C.white, fontWeight: 700,
               fontSize: '0.875rem' },
  rowCounts: { color: 'rgba(255,255,255,0.7)',
               fontSize: '0.8125rem' },

  assistRow: {
    display: 'flex', flexDirection: 'column', gap: '0.3rem',
    padding: '0.75rem 0.85rem',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.20)',
    borderRadius: '10px',
  },
  assistTop: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '0.5rem',
  },
  assistOpp:  { color: C.white, fontWeight: 700,
                fontSize: '0.9375rem' },
  assistDate: { color: 'rgba(255,255,255,0.55)',
                fontSize: '0.75rem' },
  assistContact: {
    display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
    color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem',
    alignItems: 'center',
  },
  assistPhone: {
    color: C.lightGreen, textDecoration: 'none',
    fontWeight: 700,
  },
  assistMessage: {
    margin: 0, color: 'rgba(255,255,255,0.78)',
    fontSize: '0.8125rem', fontStyle: 'italic',
  },
  assistActions: { display: 'flex', gap: '0.4rem' },
  assistBtn: {
    padding: '0.35rem 0.75rem', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent', color: C.white,
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },

  empty: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '1rem',
    textAlign: 'center',
  },
  emptyText: { margin: 0, color: 'rgba(255,255,255,0.7)',
               fontSize: '0.875rem' },

  honesty: {
    margin: 0, color: 'rgba(255,255,255,0.55)',
    fontSize: '0.8125rem', fontStyle: 'italic',
  },
};
