/**
 * I18nHealthPage.jsx — /admin/i18n-health debug surface.
 *
 * Sprint #183. Surfaces what the i18n system thinks is happening:
 *   - Current language code
 *   - Available launch locales (after the Hindi flag)
 *   - Translation coverage % per locale (from window.__languageHealth)
 *   - Missing translations summary (count + locales requiring review)
 *
 * Role-gated to admin / super_admin / ngo / field_officer (same set
 * as ScanTracePage). Read-only — no mutations. Never throws — every
 * window read goes through _safe.
 *
 * The data sources are the existing __languageHealth() + __i18nAudit()
 * globals. If neither is present, the page renders a friendly
 * "diagnostics not yet wired" state so it never dead-ends.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAppPrefs } from '../../context/AppPrefsContext.jsx';
import { SUPPORTED_LOCALES, getLaunchLocales } from '../../i18n/supportedLocales.ts';
import { isFeatureEnabled } from '../../config/features.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _isObj = (v) => v != null && typeof v === 'object';

const ALLOWED_ROLES = new Set(['admin', 'super_admin', 'ngo', 'field_officer']);

function _readGlobal(name) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window) return null;
    const w = window;
    const fn = w[name];
    if (typeof fn !== 'function') return null;
    const v = fn();
    return v && typeof v === 'object' ? v : null;
  }, null);
}

export default function I18nHealthPage() {
  const { language, role } = useAppPrefs();
  const [tick, setTick] = useState(0);

  // Re-read globals every 2s so a language switch reflects live.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const health = useMemo(() => _readGlobal('__languageHealth'), [tick]);
  const audit  = useMemo(() => _readGlobal('__i18nAudit'),      [tick]);

  const launchLocales = useMemo(() =>
    getLaunchLocales({
      enableHindi: isFeatureEnabled('enableHindiLocale'),
    }),
    []);

  if (!ALLOWED_ROLES.has(String(role || '').toLowerCase())) {
    return (
      <main style={S.page} data-testid="i18n-health-forbidden">
        <h1 style={S.title}>Forbidden</h1>
        <p style={S.body}>This page is for admins and field officers only.</p>
      </main>
    );
  }

  const coverageByLocale = (health && _isObj(health.translationCoverageByLocale))
    ? health.translationCoverageByLocale
    : null;
  const reviewLocales = (health && Array.isArray(health.translatorReviewLocales))
    ? health.translatorReviewLocales
    : [];

  return (
    <main style={S.page} data-testid="i18n-health-page">
      <h1 style={S.title}>i18n health</h1>
      <p style={S.body}>
        Live diagnostics for the language system. Refreshes every 2s.
      </p>

      <section style={S.card} data-testid="i18n-health-current">
        <h2 style={S.cardTitle}>Current language</h2>
        <p style={S.bigCode}>{language || '(none)'}</p>
      </section>

      <section style={S.card} data-testid="i18n-health-available">
        <h2 style={S.cardTitle}>Available languages ({launchLocales.length})</h2>
        <ul style={S.list}>
          {launchLocales.map((l) => (
            <li key={l.code} style={S.row}>
              <span style={S.rowCode}>{l.code}</span>
              <span style={S.rowName}>{l.nativeName}</span>
              <span style={S.rowMuted}>{l.englishName}</span>
            </li>
          ))}
        </ul>
      </section>

      <section style={S.card} data-testid="i18n-health-coverage">
        <h2 style={S.cardTitle}>Translation coverage</h2>
        {coverageByLocale ? (
          <ul style={S.list}>
            {Object.entries(coverageByLocale).map(([code, pct]) => {
              const n = typeof pct === 'number' ? Math.max(0, Math.min(100, pct)) : 0;
              const tone = n >= 80 ? '#10B981' : n >= 50 ? '#F59E0B' : '#EF4444';
              return (
                <li key={code} style={S.row}>
                  <span style={S.rowCode}>{code}</span>
                  <span style={{ ...S.bar, background: 'rgba(31,41,51,0.08)' }}>
                    <span style={{
                      ...S.barFill,
                      width: n + '%',
                      background: tone,
                    }} />
                  </span>
                  <span style={{ ...S.rowMuted, minWidth: 56, textAlign: 'right' }}>
                    {n}%
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={S.body} data-testid="i18n-health-coverage-empty">
            __languageHealth() did not report coverage. Diagnostics not yet wired.
          </p>
        )}
      </section>

      <section style={S.card} data-testid="i18n-health-review">
        <h2 style={S.cardTitle}>Needs translator review</h2>
        {reviewLocales.length > 0 ? (
          <p style={S.body}>
            {reviewLocales.length} locale{reviewLocales.length === 1 ? '' : 's'}:
            {' '}
            <strong>{reviewLocales.join(', ')}</strong>. Partial coverage —
            missing keys fall back to English.
          </p>
        ) : (
          <p style={S.body}>No locales currently flagged for review.</p>
        )}
      </section>

      <section style={S.card} data-testid="i18n-health-raw">
        <h2 style={S.cardTitle}>Raw __languageHealth()</h2>
        <pre style={S.pre}>
{health ? JSON.stringify(health, null, 2) : '(global not installed)'}
        </pre>
      </section>

      {audit ? (
        <section style={S.card} data-testid="i18n-health-audit">
          <h2 style={S.cardTitle}>Raw __i18nAudit()</h2>
          <pre style={S.pre}>{JSON.stringify(audit, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}

const S = {
  page: {
    background: '#F6F1E7',
    minHeight: '100vh',
    padding: '20px 16px 96px',
    maxWidth: 760,
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: '#1F2933',
    margin: '0 0 4px',
  },
  body: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 1.5,
    margin: '0 0 12px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 12,
    border: '1px solid rgba(31,41,51,0.06)',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 8px',
  },
  bigCode: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 24,
    fontWeight: 700,
    color: '#1F4D2C',
    margin: 0,
  },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px dashed rgba(31,41,51,0.06)',
    fontSize: 14,
    color: '#1F2933',
  },
  rowCode: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    fontWeight: 700,
    color: '#1F4D2C',
    minWidth: 36,
  },
  rowName: { flex: 1, fontWeight: 600 },
  rowMuted: { color: '#64748B', fontSize: 13 },
  bar: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    display: 'inline-block',
  },
  barFill: { display: 'block', height: '100%' },
  pre: {
    background: '#F1F5F9',
    color: '#1F2933',
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    overflowX: 'auto',
    margin: 0,
  },
};
