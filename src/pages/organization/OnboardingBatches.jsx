/**
 * src/pages/organization/OnboardingBatches.jsx — table of
 * EnrollmentBatch records for the current organization.
 *
 *   Route: /organization/onboarding/batches
 *   Gate:  RoleRoute wrapper at App.jsx level. Runtime probe
 *          window.__bulkOnboardingHealth() must return
 *          available:true; otherwise a Forbidden empty state
 *          renders (defence-in-depth).
 *
 *   Each row is clickable → /organization/onboarding/batches/:batchId.
 *   Empty state directs the user to the import wizard.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Never crashes — every runtime read wrapped in try/catch.
 *   • No direct fetch calls — reads from the in-memory snapshot.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';

const STATUS_COLOR = {
  uploaded:     '#64748B',
  validating:   '#B45309',
  ready:        '#1D4ED8',
  importing:    '#B45309',
  completed:    '#16A34A',
  failed:       '#B91C1C',
  needs_review: '#B45309',
};

const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '20px 16px 96px',
    maxWidth: 1100,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' },
  sub:    { fontSize: 13, color: '#475569', margin: '0 0 18px' },
  empty:  { textAlign: 'center', padding: 60, color: '#64748B' },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
    overflowX: 'auto',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left', fontWeight: 700, color: '#475569',
    padding: '8px 10px',
    borderBottom: '1px solid rgba(31,41,51,0.1)',
    fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  thNum: {
    textAlign: 'right',
  },
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
    verticalAlign: 'top',
  },
  tdNum: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  rowLink: {
    cursor: 'pointer',
    textDecoration: 'none',
    color: '#1F2933',
  },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  },
  cta: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none', display: 'inline-block',
    fontFamily: 'inherit',
  },
};

function _safeProbe(name) {
  try {
    if (typeof window === 'undefined') return null;
    const fn = window[name];
    if (typeof fn !== 'function') return null;
    return fn();
  } catch { return null; }
}

function _listBatches() {
  try {
    if (typeof window === 'undefined') return [];
    const rt = window.bulkOnboardingRuntime;
    if (!rt || typeof rt.listBatches !== 'function') return [];
    const list = rt.listBatches();
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export default function OnboardingBatchesPage() {
  const health = useMemo(() => _safeProbe('__bulkOnboardingHealth'), []);
  const available = health && health.available !== false;
  const batches = useMemo(() => _listBatches(), []);

  if (!available) {
    return (
      <main style={S.page}
        data-testid="organization-onboarding-batches"
        data-forbidden="true">
        <h1 style={S.header}>
          {tSafe('orgOnboardingBatches.title', 'Onboarding batches')}
        </h1>
        <div style={S.empty}>
          {tSafe('orgOnboardingBatches.forbidden',
            'This feature is not available for your account.')}
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-testid="organization-onboarding-batches">
      <h1 style={S.header}>
        {tSafe('orgOnboardingBatches.title', 'Onboarding batches')}
      </h1>
      <p style={S.sub}>
        {tSafe('orgOnboardingBatches.subtitle',
          'Every CSV your organization has uploaded — most recent first.')}
      </p>

      {batches.length === 0 ? (
        <section style={S.card}
          data-testid="orgOnboardingBatches-empty">
          <div style={S.empty}>
            <div style={{ marginBottom: 12 }}>
              {tSafe('orgOnboardingBatches.empty',
                'Upload your first farmer list.')}
            </div>
            <Link to="/organization/onboarding/import" style={S.cta}
              data-testid="orgOnboardingBatches-empty-cta">
              {tSafe('orgOnboardingBatches.emptyCta', 'Start an import')}
            </Link>
          </div>
        </section>
      ) : (
        <section style={S.card}
          data-testid="orgOnboardingBatches-table-card">
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>
                  {tSafe('orgOnboardingBatches.colFile', 'File')}
                </th>
                <th style={S.th}>
                  {tSafe('orgOnboardingBatches.colUploadedBy',
                    'Uploaded by')}
                </th>
                <th style={S.th}>
                  {tSafe('orgOnboardingBatches.colStatus', 'Status')}
                </th>
                <th style={{ ...S.th, ...S.thNum }}>
                  {tSafe('orgOnboardingBatches.colTotal', 'Total')}
                </th>
                <th style={{ ...S.th, ...S.thNum }}>
                  {tSafe('orgOnboardingBatches.colValid', 'Valid')}
                </th>
                <th style={{ ...S.th, ...S.thNum }}>
                  {tSafe('orgOnboardingBatches.colInvalid', 'Invalid')}
                </th>
                <th style={{ ...S.th, ...S.thNum }}>
                  {tSafe('orgOnboardingBatches.colDuplicates',
                    'Duplicates')}
                </th>
                <th style={{ ...S.th, ...S.thNum }}>
                  {tSafe('orgOnboardingBatches.colImported',
                    'Imported')}
                </th>
                <th style={{ ...S.th, ...S.thNum }}>
                  {tSafe('orgOnboardingBatches.colFailed', 'Failed')}
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const id = (b && (b.id || b.batchId)) || '';
                const status = (b && b.status) || 'unknown';
                const color = STATUS_COLOR[status] || '#475569';
                const counts = (b && b.counts) || {};
                const rowProps = {
                  key: id,
                  'data-testid': `orgOnboardingBatches-row-${id}`,
                };
                return (
                  <tr {...rowProps}>
                    <td style={S.td}>
                      <Link to={`/organization/onboarding/batches/${id}`}
                        style={S.rowLink}
                        data-testid={`orgOnboardingBatches-link-${id}`}>
                        {(b && (b.fileName || b.file_name)) || '—'}
                      </Link>
                    </td>
                    <td style={S.td}>
                      {(b && (b.uploadedByName || b.uploadedBy)) || '—'}
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.statusPill,
                                     background: color + '22',
                                     color }}>
                        {status}
                      </span>
                    </td>
                    <td style={{ ...S.td, ...S.tdNum }}>
                      {Number(counts.total || b.totalRows || 0)}
                    </td>
                    <td style={{ ...S.td, ...S.tdNum }}>
                      {Number(counts.valid || 0)}
                    </td>
                    <td style={{ ...S.td, ...S.tdNum }}>
                      {Number(counts.invalid || 0)}
                    </td>
                    <td style={{ ...S.td, ...S.tdNum }}>
                      {Number(counts.duplicate || counts.duplicates || 0)}
                    </td>
                    <td style={{ ...S.td, ...S.tdNum }}>
                      {Number(counts.imported || 0)}
                    </td>
                    <td style={{ ...S.td, ...S.tdNum }}>
                      {Number(counts.failed || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
