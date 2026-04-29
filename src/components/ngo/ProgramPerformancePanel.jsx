/**
 * ProgramPerformancePanel — NGO dashboard program funnel.
 *
 *   <ProgramPerformancePanel />
 *
 * Per spec § 5: a Program Performance table with columns
 *   * Program name
 *   * Sent count
 *   * Opened count
 *   * Acted count
 *
 * Strict-rule audit
 *   * Read-only — never mutates programStore.
 *   * Empty state — calm "No programs sent yet" with a
 *     deep link to /admin/programs so the operator knows
 *     where to start.
 *   * Funnel honesty: programStore.programPerformanceSummary
 *     bumps `opened` for ACTED rows so the funnel reads
 *     sent ≥ opened ≥ acted.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  programPerformanceSummary,
} from '../../programs/programStore.js';
import { tSafe } from '../../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../../brand/farrowayBrand.js';

const C = FARROWAY_BRAND.colors;

export default function ProgramPerformancePanel({
  testId = 'ngo-program-performance',
}) {
  const rows = useMemo(() => programPerformanceSummary(), []);

  return (
    <section style={S.section} data-testid={testId}>
      <header style={S.header}>
        <div>
          <p style={S.label}>
            {tSafe('program.ngoPanelLabel', 'Program performance')}
          </p>
          <h2 style={S.title}>
            {tSafe('program.ngoPanelTitle',
              'How farmers are responding to your programs')}
          </h2>
        </div>
        <Link to="/admin/programs" style={S.cta}
              data-testid={`${testId}-create`}>
          + {tSafe('program.newProgram', 'New program')}
        </Link>
      </header>

      {rows.length === 0 ? (
        <div style={S.empty}>
          <span style={S.emptyIcon} aria-hidden="true">📨</span>
          <p style={S.emptyText}>
            {tSafe('program.empty', 'No programs sent yet.')}
          </p>
          <p style={S.emptyHint}>
            {tSafe('program.emptyHint',
              'Create a program to send a short message to a group of farmers — by crop, region, or both.')}
          </p>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table} data-testid={`${testId}-table`}>
            <thead>
              <tr>
                <th style={S.th}>{tSafe('program.colName', 'Program')}</th>
                <th style={S.thNum}>{tSafe('program.colSent',   'Sent')}</th>
                <th style={S.thNum}>{tSafe('program.colOpened', 'Opened')}</th>
                <th style={S.thNum}>{tSafe('program.colActed',  'Acted')}</th>
                <th style={S.thNum}>{tSafe('program.colRate',   'Acted %')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rate = r.sent > 0
                  ? Math.round((r.acted / r.sent) * 100) : 0;
                return (
                  <tr key={r.programId} style={S.tr}>
                    <td style={S.td}>
                      <span style={S.titleCell}>{r.title}</span>
                      <span style={S.typeCell}>{r.type}</span>
                    </td>
                    <td style={S.tdNum}>
                      {Number(r.sent || 0).toLocaleString()}
                    </td>
                    <td style={S.tdNum}>
                      {Number(r.opened || 0).toLocaleString()}
                    </td>
                    <td style={S.tdNum}>
                      {Number(r.acted || 0).toLocaleString()}
                    </td>
                    <td style={{ ...S.tdNum,
                                 color: rate >= 30 ? C.lightGreen
                                      : rate >= 10 ? '#FCD34D'
                                                   : 'rgba(255,255,255,0.5)' }}>
                      {rate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={S.honesty}>
        {tSafe('program.honesty',
          'Acted % = farmers who tapped the program\u2019s primary action. The dashboard\u2019s only metric — never the only signal.')}
      </p>
    </section>
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
    padding: '0.5rem 0.95rem', borderRadius: '10px',
    background: C.green, color: C.white,
    fontSize: '0.875rem', fontWeight: 800,
    textDecoration: 'none',
    boxShadow: '0 6px 18px rgba(34,197,94,0.20)',
    flexShrink: 0,
  },

  tableWrap: { overflowX: 'auto' },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.75rem',
    fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '0.5rem 0.6rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  thNum: {
    textAlign: 'right',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.75rem',
    fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '0.5rem 0.6rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '0.55rem 0.6rem', verticalAlign: 'top' },
  tdNum: { padding: '0.55rem 0.6rem', textAlign: 'right',
           fontFeatureSettings: '"tnum" 1' },
  titleCell: { display: 'block', color: C.white, fontWeight: 700 },
  typeCell:  { display: 'block', color: 'rgba(255,255,255,0.5)',
               fontSize: '0.75rem',
               textTransform: 'uppercase', letterSpacing: '0.06em' },

  empty: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center', gap: '0.4rem',
  },
  emptyIcon: { fontSize: '1.5rem' },
  emptyText: { margin: 0, color: C.white, fontWeight: 700,
               fontSize: '0.9375rem' },
  emptyHint: { margin: 0, color: 'rgba(255,255,255,0.6)',
               fontSize: '0.875rem', maxWidth: '28rem' },

  honesty: {
    margin: 0, color: 'rgba(255,255,255,0.55)',
    fontSize: '0.8125rem', fontStyle: 'italic',
  },
};
