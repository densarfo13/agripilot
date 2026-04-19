/**
 * PrimaryTaskCard — top action card for the Today screen.
 * Pure presentational: parent passes the already-localized task.
 */
import { useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function PrimaryTaskCard({ task, warning, onComplete, onSkip, onReportIssue, onHarvest, harvestEligible = false }) {
  const { t } = useAppSettings();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleComplete() {
    if (!task || busy || task.source?.startsWith('override:')) return;
    setBusy(true); setErr(null);
    try { await onComplete?.(task); }
    catch (e) { setErr(e?.code || 'error'); }
    finally { setBusy(false); }
  }

  function handleSkip() {
    // Delegates to the parent, which opens the localized modal. The
    // modal handles the reason prompt, so this component no longer
    // reaches for window.prompt.
    if (!task || busy || task.source?.startsWith('override:')) return;
    onSkip?.(task);
  }

  if (!task) {
    return (
      <div style={S.empty} data-testid="primary-task-empty">
        <div style={S.emptyIcon}>{'\u2728'}</div>
        <h2 style={S.emptyTitle}>{t('actionHome.primary.noTask')}</h2>
        <p style={S.emptyBody}>{t('actionHome.primary.noTaskHint')}</p>
      </div>
    );
  }

  return (
    <div style={S.card} data-testid="primary-task-card">
      <div style={S.label}>{t('actionHome.primary.title')}</div>
      <h2 style={S.title}>{task.title}</h2>

      {task.detail && (
        <div style={S.whyRow}>
          <div style={S.whyLabel}>{t('actionHome.primary.why')}</div>
          <div style={S.whyBody}>{task.detail}</div>
        </div>
      )}

      <div style={S.etaRow}>
        <span style={S.etaIcon}>{'\u23F1\uFE0F'}</span>
        <span style={S.etaLabel}>{t('actionHome.primary.eta')}:</span>
        <span style={S.etaValue}>
          {task.eta || t('actionHome.primary.minutes', { n: task.timeEstimateMinutes || 15 })}
        </span>
      </div>

      {warning?.show && (
        <div style={S.warning}>
          <span style={S.warningIcon}>{'\u26A0\uFE0F'}</span>
          <div>
            <div style={S.warningTitle}>{t('cropFit.warning.lowFit')}</div>
            <div style={S.warningBody}>{t(warning.reasonKey || 'cropFit.warning.reason')}</div>
          </div>
        </div>
      )}

      {err && <div style={S.err}>{t('issue.err.generic')}</div>}

      <div style={S.ctaRow}>
        <button
          type="button"
          onClick={handleComplete}
          disabled={busy || task.source?.startsWith('override:')}
          style={{ ...S.cta, ...(busy ? S.ctaBusy : null) }}
          data-testid="primary-task-complete"
        >
          {busy ? t('actionHome.primary.markingDone') : t('actionHome.primary.markComplete')}
        </button>
        {onSkip && !task.source?.startsWith('override:') && (
          <button
            type="button"
            onClick={handleSkip}
            style={S.ctaGhost}
            data-testid="primary-task-skip"
          >
            {t('actionHome.primary.skip')}
          </button>
        )}
        {onReportIssue && (
          <button
            type="button"
            onClick={onReportIssue}
            style={S.ctaGhost}
            data-testid="primary-task-report"
          >
            {t('actionHome.primary.reportIssue')}
          </button>
        )}
      </div>

      {harvestEligible && onHarvest && (
        <button
          type="button"
          onClick={onHarvest}
          style={S.ctaHarvest}
          data-testid="primary-task-harvest"
        >
          {t('actionHome.primary.reportHarvest')}
        </button>
      )}
    </div>
  );
}

const S = {
  card: {
    padding: '1.25rem',
    borderRadius: '20px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.22)',
    boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
  },
  empty: {
    padding: '1.5rem',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
    color: '#EAF2FF',
  },
  emptyIcon: { fontSize: '2rem', marginBottom: '0.5rem' },
  emptyTitle: { fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.25rem' },
  emptyBody: { fontSize: '0.9375rem', color: '#9FB3C8', margin: 0 },
  label: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#22C55E',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: '0.375rem',
  },
  title: { fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.625rem', lineHeight: 1.3, color: '#EAF2FF' },
  whyRow: {
    padding: '0.625rem 0.75rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    marginBottom: '0.625rem',
  },
  whyLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#9FB3C8',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.125rem',
  },
  whyBody: { fontSize: '0.875rem', lineHeight: 1.4, color: '#EAF2FF' },
  etaRow: {
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    fontSize: '0.8125rem', color: '#9FB3C8', marginBottom: '0.75rem',
  },
  etaIcon: { fontSize: '1rem' },
  etaLabel: { color: '#6F8299' },
  etaValue: { color: '#EAF2FF', fontWeight: 600 },
  warning: {
    display: 'flex', gap: '0.5rem', padding: '0.625rem 0.75rem',
    borderRadius: '12px', background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.25)',
    marginBottom: '0.75rem', color: '#EAF2FF',
  },
  warningIcon: { fontSize: '1.125rem' },
  warningTitle: { fontWeight: 700, fontSize: '0.875rem' },
  warningBody: { fontSize: '0.8125rem', color: '#9FB3C8', marginTop: '0.125rem' },
  err: { color: '#FCA5A5', fontSize: '0.8125rem', marginBottom: '0.5rem' },
  ctaRow: { display: 'flex', gap: '0.5rem' },
  cta: {
    flex: 1, padding: '0.875rem', borderRadius: '14px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '52px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  ctaGhost: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    minHeight: '52px',
  },
  ctaBusy: { opacity: 0.7, cursor: 'wait' },
  ctaHarvest: {
    marginTop: '0.75rem', width: '100%',
    padding: '0.875rem', borderRadius: '14px', border: 'none',
    background: '#F59E0B', color: '#1b1b1f',
    fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px',
  },
};
