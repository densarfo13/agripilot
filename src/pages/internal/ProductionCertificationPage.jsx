/**
 * src/pages/internal/ProductionCertificationPage.jsx — Internal-only
 * Production Certification dashboard.
 *
 *   Route: /internal/production-certification
 *   Gate:  localStorage.farroway_internal === '1'
 *
 * What this is
 * ────────────
 *   Renders the live Production Certification verdict against the
 *   launch spec — QA cross-device checklist, knowledge content
 *   counts, media validation, privacy readiness, monitoring,
 *   backup / rollback. Refresh re-probes; Export downloads the
 *   canonical JSON envelope.
 *
 *   Normal users never see this — the page renders an
 *   "Internal only" empty state when the flag is absent.
 *
 * Strict-rule audit
 *   • Pure render. Reads localStorage only via the gated runtime.
 *   • All copy via tSafe envelopes { key, def }.
 *   • Never crashes — every read wrapped in try/catch.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { INTERNAL_FLAG_KEY } from '../../runtime/release/releaseLockContracts';
import {
  productionCertification,
  exportProductionCertificationReport,
} from '../../runtime/certification/index';

// ─── tSafe envelope helper ────────────────────────────────────
// All page copy goes through { key, def } envelopes so a missing
// translation never crashes and the fallback is always visible.
const tx = (env) => {
  try {
    if (!env || typeof env !== 'object') return '';
    return tSafe(env.key, env.def);
  } catch {
    return (env && env.def) || '';
  }
};

const VERDICT_BG = {
  GREEN:  '#DCFCE7',
  YELLOW: '#FEF3C7',
  RED:    '#FEE2E2',
};
const VERDICT_FG = {
  GREEN:  '#166534',
  YELLOW: '#92400E',
  RED:    '#B91C1C',
};

const STATUS_COLOR = {
  PASS:    '#16A34A',
  FAIL:    '#B91C1C',
  PENDING: '#64748B',
  WARN:    '#B45309',
};

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
  verdictCard: {
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 14,
  },
  verdictRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    flexWrap: 'wrap',
  },
  verdictBadge: {
    fontSize: 24, fontWeight: 800, letterSpacing: '0.04em',
  },
  scorePill: {
    fontSize: 13, fontWeight: 700,
    padding: '4px 10px', borderRadius: 999,
    background: 'rgba(31,41,51,0.06)',
  },
  metaRow: {
    fontSize: 12, color: '#475569',
    marginTop: 6,
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginTop: 14, marginBottom: 6,
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
  },
  tcell: {
    padding: '6px 4px',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
    verticalAlign: 'top',
  },
  tcellRight: {
    padding: '6px 4px',
    borderBottom: '1px solid rgba(31,41,51,0.05)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  statusPill: {
    display: 'inline-block',
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  },
  targetChip: {
    display: 'inline-block',
    fontSize: 10, fontWeight: 700,
    padding: '2px 6px', borderRadius: 6,
    marginLeft: 6,
    background: 'rgba(31,41,51,0.06)',
    color: '#475569',
  },
  countNum: { fontWeight: 700, color: '#1F2933' },
  cta: {
    appearance: 'none', border: 'none',
    background: '#C8944D', color: '#FFFFFF',
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', marginRight: 8,
  },
  ctaSecondary: {
    appearance: 'none', border: '1px solid rgba(31,41,51,0.16)',
    background: '#FFFFFF', color: '#1F2933',
    padding: '8px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', marginRight: 8,
  },
  list: { margin: 0, padding: '4px 0 0 18px', fontSize: 12 },
  listItem: { padding: '2px 0', color: '#1F2933' },
  empty: {
    textAlign: 'center', padding: 60, color: '#64748B',
  },
};

function _isInternal() {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage
            && window.localStorage.getItem(INTERNAL_FLAG_KEY) === '1';
  } catch { return false; }
}

// ─── Status normalisation ──────────────────────────────────────
// The runtime exposes booleans + strings. Normalise to one of
// PASS / FAIL / PENDING / WARN so the badge component is dumb.
function _statusFromBool(v) {
  if (v === true)  return 'PASS';
  if (v === false) return 'FAIL';
  return 'PENDING';
}
function _statusFromString(v) {
  if (typeof v !== 'string') return 'PENDING';
  const u = v.toUpperCase();
  if (u === 'PASS' || u === 'PASSED' || u === 'OK')      return 'PASS';
  if (u === 'FAIL' || u === 'FAILED' || u === 'ERROR')   return 'FAIL';
  if (u === 'WARN' || u === 'WARNING' || u === 'YELLOW') return 'WARN';
  return 'PENDING';
}
function _statusFromAny(v) {
  if (typeof v === 'boolean') return _statusFromBool(v);
  if (typeof v === 'string')  return _statusFromString(v);
  return 'PENDING';
}

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || '#475569';
  return (
    <span
      style={{
        ...S.statusPill,
        background: c + '22',
        color: c,
      }}
    >
      {status}
    </span>
  );
}

// ─── QA checklist rows ─────────────────────────────────────────
const QA_FIELDS = [
  { id: 'iphoneSafari',
    env: { key: 'cert.qa.iphoneSafari',
            def: 'iPhone Safari — scan + offline' } },
  { id: 'iphone_pwa_or_testflight',
    env: { key: 'cert.qa.iphonePwaTestflight',
            def: 'iPhone PWA or TestFlight' } },
  { id: 'androidChrome',
    env: { key: 'cert.qa.androidChrome',
            def: 'Android Chrome — scan + offline' } },
  { id: 'androidPwa',
    env: { key: 'cert.qa.androidPwa',
            def: 'Android installed PWA' } },
  { id: 'scanSuccessRate',
    env: { key: 'cert.qa.scanSuccessRate',
            def: 'Scan success rate ≥ 90%' } },
  { id: 'offlineReconnectPassed',
    env: { key: 'cert.qa.offlineReconnect',
            def: 'Offline → reconnect sync' } },
  { id: 'duplicatePreventionPassed',
    env: { key: 'cert.qa.dedupe',
            def: 'Duplicate prevention verified' } },
];

const PRIVACY_FIELDS = [
  { id: 'policyReady',
    env: { key: 'cert.privacy.policy',
            def: 'Privacy policy ready' } },
  { id: 'termsReady',
    env: { key: 'cert.privacy.terms',
            def: 'Terms of service ready' } },
  { id: 'cameraDisclosureReady',
    env: { key: 'cert.privacy.camera',
            def: 'Camera disclosure ready' } },
  { id: 'photoDisclosureReady',
    env: { key: 'cert.privacy.photo',
            def: 'Photo library disclosure ready' } },
  { id: 'locationDisclosureReady',
    env: { key: 'cert.privacy.location',
            def: 'Location disclosure ready' } },
  { id: 'appStoreNutritionReady',
    env: { key: 'cert.privacy.nutrition',
            def: 'App Store privacy nutrition ready' } },
];

const CONTENT_FIELDS = [
  { id: 'plants',         target: 200,
    env: { key: 'cert.content.plants', def: 'Plants' } },
  { id: 'diseases',       target: 15,
    env: { key: 'cert.content.diseases', def: 'Diseases' } },
  { id: 'pests',          target: 15,
    env: { key: 'cert.content.pests', def: 'Pests' } },
  { id: 'mediaValidated', target: null,
    env: { key: 'cert.content.media', def: 'Media validated' } },
  { id: 'brokenImages',   target: 0, inverse: true,
    env: { key: 'cert.content.broken', def: 'Broken images' } },
];

// Build a safe empty envelope so the page renders even when the
// runtime is missing (e.g. before the index file ships).
const EMPTY_ENVELOPE = Object.freeze({
  verdict: 'RED',
  score: 0,
  lastChecked: '',
  blockers: [],
  warnings: [],
  qa: {},
  content: { counts: {}, media: { brokenImages: 0, sample: [] } },
  privacy: {},
  operations: { monitoringReady: false,
                 backupRestoreDocumented: false,
                 rollbackPlanReady: false },
});

export default function ProductionCertificationPage() {
  const [tick, setTick] = useState(0);
  const [internal, setInternal] = useState(false);

  useEffect(() => { setInternal(_isInternal()); }, []);

  const cert = useMemo(() => {
    try {
      const out = productionCertification();
      return out || EMPTY_ENVELOPE;
    } catch {
      return EMPTY_ENVELOPE;
    }
  }, [tick]);

  const onRefresh = useCallback(() => setTick((t) => t + 1), []);

  const onExport = useCallback(() => {
    try {
      const report = exportProductionCertificationReport();
      const blob = new Blob([JSON.stringify(report, null, 2)],
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = (report && report.timestamp
                      ? String(report.timestamp)
                      : new Date().toISOString())
                      .replace(/[:.]/g, '-');
      a.download = 'FARROWAY_PRODUCTION_CERTIFICATION_' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* never crash on export */ }
  }, []);

  if (!internal) {
    return (
      <main style={S.page}
        data-testid="production-certification-internal-only">
        <h1 style={S.header}>
          {tx({ key: 'cert.title',
                 def: 'Production Certification' })}
        </h1>
        <div style={S.empty}>
          {tx({ key: 'cert.notInternal',
                 def: 'Internal only. '
                   + 'Set localStorage.farroway_internal = "1" to view.' })}
        </div>
      </main>
    );
  }

  const verdict = (cert && cert.verdict) || 'RED';
  const score   = (cert && typeof cert.score === 'number') ? cert.score : 0;
  const qa      = (cert && cert.qa) || {};
  const content = (cert && cert.content) || {};
  const counts  = (content && content.counts) || {};
  const media   = (content && content.media)
                    || { brokenImages: 0, sample: [] };
  const privacy = (cert && cert.privacy) || {};
  const ops     = (cert && cert.operations) || {};
  const blockers = Array.isArray(cert && cert.blockers)
                     ? cert.blockers : [];
  const warnings = Array.isArray(cert && cert.warnings)
                     ? cert.warnings : [];

  const monitoringStatus = _statusFromBool(ops.monitoringReady);
  const backupStatus     = _statusFromBool(ops.backupRestoreDocumented);
  const rollbackStatus   = _statusFromBool(ops.rollbackPlanReady);

  return (
    <main
      style={S.page}
      data-testid="production-certification-page"
      data-verdict={verdict}
    >
      <h1 style={S.header}>
        {tx({ key: 'cert.title',
               def: 'Farroway Production Certification' })}
      </h1>
      <p style={S.sub}>
        {tx({ key: 'cert.subtitle',
               def: 'Honest verdict against the production launch '
                 + 'spec — QA, content, privacy, ops.' })}
      </p>

      {/* Hero verdict */}
      <section
        style={{ ...S.verdictCard,
                  background: VERDICT_BG[verdict] || VERDICT_BG.RED,
                  color: VERDICT_FG[verdict] || VERDICT_FG.RED }}
        data-testid="production-certification-verdict"
      >
        <div style={S.verdictRow}>
          <div style={S.verdictBadge}>{verdict}</div>
          <div style={S.scorePill}>
            {tx({ key: 'cert.score', def: 'Score' })}
            : {score} / 100
          </div>
          <div style={S.scorePill}>
            {blockers.length}
            {' '}{tx({ key: 'cert.blockers', def: 'blockers' })}
          </div>
          <div style={S.scorePill}>
            {warnings.length}
            {' '}{tx({ key: 'cert.warnings', def: 'warnings' })}
          </div>
        </div>
        <div style={S.metaRow}>
          {tx({ key: 'cert.lastChecked', def: 'Last checked' })}
          : {(cert && cert.lastChecked) || '—'}
        </div>
      </section>

      {/* Actions */}
      <div style={{ marginBottom: 14 }}>
        <button
          type="button"
          style={S.cta}
          onClick={onRefresh}
          data-testid="production-certification-refresh"
        >
          {tx({ key: 'cert.refresh', def: 'Refresh' })}
        </button>
        <button
          type="button"
          style={S.cta}
          onClick={onExport}
          data-testid="production-certification-export"
        >
          {tx({ key: 'cert.export', def: 'Export JSON' })}
        </button>
      </div>

      {/* 1. QA checklist */}
      <div data-testid="production-certification-section-qa">
        <div style={S.sectionTitle}>
          {tx({ key: 'cert.section.qa',
                 def: '1. QA checklist' })}
        </div>
        <div style={S.card}>
          <table style={S.table}>
            <tbody>
              {QA_FIELDS.map((row) => {
                const status = _statusFromAny(qa[row.id]);
                return (
                  <tr key={row.id}>
                    <td style={S.tcell}>{tx(row.env)}</td>
                    <td style={S.tcellRight}>
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Content counts */}
      <div data-testid="production-certification-section-content">
        <div style={S.sectionTitle}>
          {tx({ key: 'cert.section.content',
                 def: '2. Content counts' })}
        </div>
        <div style={S.card}>
          <table style={S.table}>
            <tbody>
              {CONTENT_FIELDS.map((row) => {
                const raw = counts[row.id];
                const num = typeof raw === 'number' ? raw : 0;
                let status = 'PENDING';
                if (row.target != null) {
                  if (row.inverse) {
                    status = num <= row.target ? 'PASS' : 'FAIL';
                  } else {
                    status = num >= row.target ? 'PASS' : 'WARN';
                  }
                } else if (typeof raw === 'boolean') {
                  status = _statusFromBool(raw);
                }
                return (
                  <tr key={row.id}>
                    <td style={S.tcell}>
                      {tx(row.env)}
                      {row.target != null ? (
                        <span style={S.targetChip}>
                          {tx({ key: 'cert.target', def: 'target' })}
                          {' '}
                          {row.inverse ? '≤' : '≥'}
                          {' '}{row.target}
                        </span>
                      ) : null}
                    </td>
                    <td style={S.tcellRight}>
                      <span style={S.countNum}>{num}</span>
                      {' '}
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Media validation */}
      <div data-testid="production-certification-section-media">
        <div style={S.sectionTitle}>
          {tx({ key: 'cert.section.media',
                 def: '3. Media validation' })}
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            {tx({ key: 'cert.media.broken',
                   def: 'Broken images' })}
            {': '}
            <span style={S.countNum}>
              {(media && typeof media.brokenImages === 'number')
                ? media.brokenImages : 0}
            </span>
            {' '}
            <StatusBadge
              status={((media && media.brokenImages) || 0) === 0
                        ? 'PASS' : 'FAIL'}
            />
          </div>
          {Array.isArray(media && media.sample) && media.sample.length > 0 ? (
            <>
              <div style={{ fontSize: 12, color: '#475569',
                              marginTop: 6 }}>
                {tx({ key: 'cert.media.sample',
                       def: 'Sample (first 5):' })}
              </div>
              <ul style={S.list}>
                {media.sample.slice(0, 5).map((entry, i) => (
                  <li key={i} style={S.listItem}>
                    {typeof entry === 'string'
                      ? entry
                      : (entry && (entry.url || entry.id))
                          || JSON.stringify(entry)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {tx({ key: 'cert.media.none',
                     def: 'No broken images detected.' })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Privacy readiness */}
      <div data-testid="production-certification-section-privacy">
        <div style={S.sectionTitle}>
          {tx({ key: 'cert.section.privacy',
                 def: '4. Privacy readiness' })}
        </div>
        <div style={S.card}>
          <table style={S.table}>
            <tbody>
              {PRIVACY_FIELDS.map((row) => {
                const status = _statusFromBool(privacy[row.id]);
                return (
                  <tr key={row.id}>
                    <td style={S.tcell}>{tx(row.env)}</td>
                    <td style={S.tcellRight}>
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Monitoring readiness */}
      <div data-testid="production-certification-section-monitoring">
        <div style={S.sectionTitle}>
          {tx({ key: 'cert.section.monitoring',
                 def: '5. Monitoring readiness' })}
        </div>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 13 }}>
            <span>
              {tx({ key: 'cert.monitoring.ready',
                     def: 'Monitoring ready' })}
            </span>
            <StatusBadge status={monitoringStatus} />
          </div>
        </div>
      </div>

      {/* 6. Backup / rollback */}
      <div data-testid="production-certification-section-backup-rollback">
        <div style={S.sectionTitle}>
          {tx({ key: 'cert.section.backupRollback',
                 def: '6. Backup / rollback' })}
        </div>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 13, padding: '4px 0' }}>
            <span>
              {tx({ key: 'cert.ops.backup',
                     def: 'Backup / restore documented' })}
            </span>
            <StatusBadge status={backupStatus} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 13, padding: '4px 0' }}>
            <span>
              {tx({ key: 'cert.ops.rollback',
                     def: 'Rollback plan ready' })}
            </span>
            <StatusBadge status={rollbackStatus} />
          </div>
        </div>
      </div>

      {/* 7. Blockers (red) */}
      {blockers.length > 0 ? (
        <section
          style={{ ...S.card,
                    borderColor: '#FCA5A5', background: '#FEF2F2' }}
          data-testid="production-certification-blockers"
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C',
                         textTransform: 'uppercase', letterSpacing: '0.06em',
                         marginBottom: 4 }}>
            {tx({ key: 'cert.blockerList', def: 'Blockers' })}
          </div>
          {blockers.map((b, i) => {
            const id     = (b && (b.id || b.code)) || ('blocker-' + i);
            const detail = (b && (b.detail || b.message)) || '';
            return (
              <div
                key={id + ':' + i}
                style={{ fontSize: 12, color: '#1F2933', padding: '2px 0' }}
              >
                {'✗ '}
                <strong>{String(id)}</strong>
                {detail ? ' — ' + String(detail) : ''}
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Warnings (amber) */}
      {warnings.length > 0 ? (
        <section
          style={{ ...S.card,
                    borderColor: '#FCD34D', background: '#FFFBEB' }}
          data-testid="production-certification-warnings"
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#B45309',
                         textTransform: 'uppercase', letterSpacing: '0.06em',
                         marginBottom: 4 }}>
            {tx({ key: 'cert.warningList', def: 'Warnings' })}
          </div>
          {warnings.map((w, i) => {
            const id     = (w && (w.id || w.code)) || ('warning-' + i);
            const detail = (w && (w.detail || w.message)) || '';
            return (
              <div
                key={id + ':' + i}
                style={{ fontSize: 12, color: '#1F2933', padding: '2px 0' }}
              >
                {'⚠ '}
                <strong>{String(id)}</strong>
                {detail ? ' — ' + String(detail) : ''}
              </div>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
