/**
 * src/pages/organization/OnboardingHome.jsx — Bulk farmer
 * onboarding landing page for NGO / institutional admins.
 *
 *   Route: /organization/onboarding
 *   Gate:  RoleRoute wrapper at App.jsx level (NGO admin /
 *          program manager scopes). This page renders a
 *          Forbidden empty state if the runtime probe
 *          window.__bulkOnboardingHealth() returns
 *          available:false (defence-in-depth).
 *
 * What this is
 * ────────────
 *   Top of the onboarding funnel. Three CTAs:
 *     • Start an import   → /organization/onboarding/import
 *     • CSV template      → /api/organization/onboarding/template.csv
 *     • Review batches    → /organization/onboarding/batches
 *
 *   Plus a "Recent batches" list (last 5) read from the
 *   in-memory bulkOnboardingRuntime snapshot. No fetch in
 *   this file — data wires in when the runtime ships.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Never crashes — every runtime read wrapped in try/catch.
 *   • No direct fetch calls — runtime snapshot only.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';

const S = {
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '20px 16px 96px',
    maxWidth: 960,
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' },
  sub:    { fontSize: 13, color: '#475569', margin: '0 0 18px' },
  empty:  { textAlign: 'center', padding: 60, color: '#64748B' },
  ctaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
    marginBottom: 20,
  },
  ctaCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '16px 14px',
    textDecoration: 'none',
    color: '#1F2933',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  ctaTitle: { fontSize: 14, fontWeight: 800 },
  ctaBody:  { fontSize: 12, color: '#475569', lineHeight: 1.4 },
  ctaPill: {
    alignSelf: 'flex-start', marginTop: 6,
    background: '#C8944D', color: '#FFFFFF',
    padding: '6px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginTop: 18, marginBottom: 6,
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
    fontSize: 13,
  },
  rowLabel: { flex: 1, color: '#1F2933' },
  rowMeta:  { fontSize: 11, color: '#64748B', marginTop: 2 },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
    background: 'rgba(31,41,51,0.06)', color: '#475569',
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

function _readRecent() {
  try {
    if (typeof window === 'undefined') return [];
    const rt = window.bulkOnboardingRuntime;
    if (!rt || typeof rt.listBatches !== 'function') return [];
    const list = rt.listBatches();
    if (!Array.isArray(list)) return [];
    return list.slice(0, 5);
  } catch { return []; }
}

export default function OnboardingHomePage() {
  const [tick, setTick] = useState(0);

  // Re-read snapshot once on mount — a future runtime can
  // pulse a custom event to bump `tick`.
  useEffect(() => { setTick((t) => t + 1); }, []);

  const health = useMemo(() => _safeProbe('__bulkOnboardingHealth'), [tick]);
  const recent = useMemo(() => _readRecent(), [tick]);

  const available = health && health.available !== false;

  if (!available) {
    return (
      <main style={S.page}
        data-testid="organization-onboarding-home"
        data-forbidden="true">
        <h1 style={S.header}>
          {tSafe('orgOnboarding.title', 'Bulk farmer onboarding')}
        </h1>
        <div style={S.empty}>
          {tSafe('orgOnboarding.forbidden',
            'This feature is not available for your account.')}
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-testid="organization-onboarding-home">
      <h1 style={S.header}>
        {tSafe('orgOnboarding.title', 'Bulk farmer onboarding')}
      </h1>
      <p style={S.sub}>
        {tSafe('orgOnboarding.subtitle',
          'Enroll your farmer roster from a CSV — validate, '
          + 'de-duplicate, and import in one pass.')}
      </p>

      <div style={S.ctaGrid}>
        <Link to="/organization/onboarding/import"
          style={S.ctaCard}
          data-testid="orgOnboarding-cta-start">
          <div style={S.ctaTitle}>
            {tSafe('orgOnboarding.ctaStart', 'Start an import')}
          </div>
          <div style={S.ctaBody}>
            {tSafe('orgOnboarding.ctaStartBody',
              'Upload a CSV and walk through validation, '
              + 'duplicate resolution, and confirmation.')}
          </div>
          <span style={S.ctaPill}>
            {tSafe('orgOnboarding.ctaStartPill', 'New batch')}
          </span>
        </Link>

        <a href="/api/organization/onboarding/template.csv"
          style={S.ctaCard}
          download
          data-testid="orgOnboarding-cta-template">
          <div style={S.ctaTitle}>
            {tSafe('orgOnboarding.ctaTemplate', 'Download CSV template')}
          </div>
          <div style={S.ctaBody}>
            {tSafe('orgOnboarding.ctaTemplateBody',
              'Pre-formatted columns with required and optional '
              + 'fields. Fill it in, then upload.')}
          </div>
          <span style={S.ctaPill}>
            {tSafe('orgOnboarding.ctaTemplatePill', 'Download')}
          </span>
        </a>

        <Link to="/organization/onboarding/batches"
          style={S.ctaCard}
          data-testid="orgOnboarding-cta-batches">
          <div style={S.ctaTitle}>
            {tSafe('orgOnboarding.ctaBatches', 'Review batches')}
          </div>
          <div style={S.ctaBody}>
            {tSafe('orgOnboarding.ctaBatchesBody',
              'Inspect previously uploaded batches and their '
              + 'import outcomes.')}
          </div>
          <span style={S.ctaPill}>
            {tSafe('orgOnboarding.ctaBatchesPill', 'View all')}
          </span>
        </Link>
      </div>

      <div style={S.sectionTitle}>
        {tSafe('orgOnboarding.recentTitle', 'Recent batches')}
      </div>

      {recent.length === 0 ? (
        <section style={S.card} data-testid="orgOnboarding-recent-empty">
          <div style={S.empty}>
            {tSafe('orgOnboarding.recentEmpty',
              'Upload your first farmer list.')}
          </div>
        </section>
      ) : (
        <section style={S.card} data-testid="orgOnboarding-recent-list">
          {recent.map((b) => {
            const id = (b && (b.id || b.batchId)) || '—';
            const fileName = (b && (b.fileName || b.file_name)) || '—';
            const status = (b && b.status) || 'unknown';
            const uploadedBy =
              (b && (b.uploadedByName || b.uploadedBy)) || '—';
            return (
              <Link key={id}
                to={`/organization/onboarding/batches/${id}`}
                style={{ ...S.row, textDecoration: 'none',
                          color: '#1F2933' }}
                data-testid={`orgOnboarding-recent-row-${id}`}>
                <div style={S.rowLabel}>
                  <div>{fileName}</div>
                  <div style={S.rowMeta}>
                    {tSafe('orgOnboarding.uploadedBy', 'Uploaded by')}
                    {': ' + uploadedBy}
                  </div>
                </div>
                <div style={S.statusPill}>{status}</div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
