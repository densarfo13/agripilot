/**
 * src/pages/internal/Godmode.jsx — Internal-only architecture
 * + release audit dashboard.
 *
 *   Route: /internal/godmode
 *   Gate:  localStorage.farroway_internal === '1'
 *
 * What this is
 * ────────────
 *   Aggregates every diagnostic the platform pins on window into
 *   one read-only audit page. Normal users see an "internal only"
 *   empty state. The page DOES NOT mutate any runtime state.
 *
 *   Diagnostics consumed:
 *     window.__scanUIHealth()
 *     window.__plantRuntimeHealth()
 *     window.__plantMediaHealth()
 *     window.__farrowayKnowledge()
 *     window.__founderMetricsHealth()
 *     window.__mobileUXHealth()
 *     window.__oodaHealth()
 *     window.__artifactHealth()
 *     window.__appStoreReadiness()
 *     window.__releaseLock()
 *     window.__farrowayBuild()
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • All copy via tSafe.
 *   • Never crashes — every probe wrapped in try/catch.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { INTERNAL_FLAG_KEY } from '../../runtime/release/releaseLockContracts';

const PROBES = [
  ['__scanUIHealth',        'Scan UI Health'],
  ['__plantRuntimeHealth',  'Plant Runtime'],
  ['__plantMediaHealth',    'Plant Media'],
  ['__farrowayKnowledge',   'Knowledge Layer'],
  ['__founderMetricsHealth','Founder Metrics'],
  ['__mobileUXHealth',      'Mobile UX'],
  ['__oodaHealth',          'OODA Engine'],
  ['__artifactHealth',      'Artifacts Layer'],
  ['__intelligenceLoopHealth','Intelligence Loop'],
  // Wave 12 — Enterprise hardening probes.
  ['__rbacHealth',          'RBAC'],
  ['__auditHealth',         'Audit Logs'],
  ['__evidenceHealth',      'Evidence Chain'],
  ['__reportHealth',        'Reports'],
  ['__outcomeHealth',       'Outcomes'],
  ['__reliabilityHealth',   'Reliability'],
  ['__enterpriseReadiness', 'Enterprise Readiness'],
  ['__appStoreReadiness',   'App Store Readiness'],
  ['__releaseLock',         'Release Lock'],
  ['__farrowayBuild',       'Build Identity'],
];

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
  sub:    { fontSize: 13, color: '#475569', margin: '0 0 14px' },
  empty:  { textAlign: 'center', padding: 60, color: '#64748B' },
  probeCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
  },
  probeTitle: {
    fontSize: 13, fontWeight: 700, color: '#1F2933',
    marginBottom: 4,
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999,
  },
  pre: {
    fontSize: 11, color: '#475569',
    background: 'rgba(31,41,51,0.04)',
    padding: 10, borderRadius: 8,
    margin: 0, overflow: 'auto', maxHeight: 240,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  topRow: {
    display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12,
  },
  refresh: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

function _isInternal() {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage
            && window.localStorage.getItem(INTERNAL_FLAG_KEY) === '1';
  } catch { return false; }
}

function _safeProbe(name) {
  try {
    if (typeof window === 'undefined') return { ok: false, missing: true };
    const fn = window[name];
    if (typeof fn !== 'function') return { ok: false, missing: true };
    const value = fn();
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

export default function GodmodePage() {
  const [internal, setInternal] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => { setInternal(_isInternal()); }, []);

  const results = useMemo(() => PROBES.map(([name, label]) => ({
    name, label, result: _safeProbe(name),
  })), [tick]);

  const onRefresh = useCallback(() => setTick((t) => t + 1), []);

  const onCopy = useCallback(() => {
    try {
      const payload = results.reduce((acc, { name, result }) => {
        acc[name] = result.value !== undefined ? result.value : null;
        return acc;
      }, {});
      navigator.clipboard && navigator.clipboard.writeText(
        JSON.stringify(payload, null, 2));
    } catch { /* ignore */ }
  }, [results]);

  if (!internal) {
    return (
      <main style={S.page} data-testid="godmode-internal-only">
        <h1 style={S.header}>{tSafe('godmode.title', 'Godmode')}</h1>
        <div style={S.empty}>
          {tSafe('godmode.notInternal',
            'This page is internal-only. '
            + 'Set localStorage.farroway_internal = "1" to view.')}
        </div>
      </main>
    );
  }

  const missingCount = results.filter((r) => r.result.missing).length;
  const errorCount   = results.filter((r) => r.result.error).length;

  return (
    <main style={S.page} data-testid="godmode-page">
      <h1 style={S.header}>
        {tSafe('godmode.title', 'Farroway Godmode')}
      </h1>
      <p style={S.sub}>
        {tSafe('godmode.subtitle',
          'Internal architecture + release audit. Read-only.')}
      </p>

      <div style={S.topRow}>
        <button type="button" style={S.refresh} onClick={onRefresh}
          data-testid="godmode-refresh">
          {tSafe('godmode.refresh', 'Refresh probes')}
        </button>
        <button type="button" style={S.refresh} onClick={onCopy}
          data-testid="godmode-copy">
          {tSafe('godmode.copy', 'Copy JSON to clipboard')}
        </button>
        <div style={{ fontSize: 12, color: '#475569',
                       alignSelf: 'center' }}>
          {results.length - missingCount - errorCount} ready
          {' · '}
          {missingCount} missing
          {' · '}
          {errorCount} errored
        </div>
      </div>

      {results.map(({ name, label, result }) => {
        const status = result.missing  ? 'missing'
                    :  result.error    ? 'error'
                    :  'ready';
        const color = status === 'ready'   ? '#16A34A'
                    : status === 'missing' ? '#94A3B8'
                    : '#B91C1C';
        return (
          <section key={name} style={S.probeCard}
            data-testid={'godmode-probe-' + name}
            data-status={status}>
            <div style={S.probeTitle}>
              <span>{label} · <code style={{ fontSize: 11 }}>{name}</code></span>
              <span style={{ ...S.statusPill, background: color + '22', color }}>
                {status}
              </span>
            </div>
            <pre style={S.pre}>{
              result.missing ? 'function not pinned on window'
              : result.error ? 'error: ' + result.error
              : JSON.stringify(result.value, null, 2)
            }</pre>
          </section>
        );
      })}
    </main>
  );
}
