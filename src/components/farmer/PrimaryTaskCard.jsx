/**
 * PrimaryTaskCard — top action card for the Today screen.
 * Pure presentational: parent passes the already-localized task.
 */
import { useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { tSafe } from '../../i18n/tSafe.js';
import { AlertCircle, Volume2 } from '../icons/lucide.jsx';
import { speak } from '../../voice/voiceEngine.js';

export default function PrimaryTaskCard({ task, warning, onComplete, onSkip, onReportIssue, onHarvest, harvestEligible = false }) {
  // Pull `language` alongside `t` from AppSettings so the inline
  // Listen button can hand the active short code to voiceEngine.speak.
  // Data path and i18n key set are unchanged — purely additive.
  const { t, language } = useAppSettings();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Urgency-aware styling. The engine emits a stable 'normal' |
  // 'important' | 'urgent' code; the UI never inspects the raw
  // reason list directly, so new reason types don't ripple here.
  const urgency = (task && task.urgency) || 'normal';
  const urgencyStyle = urgencyStyleFor(urgency);

  // Why-body can come either from the server (already localized
  // `task.detail`) or from a stable i18n key the engine emits
  // (`task.whyKey`). Fall back to the first one that resolves.
  const whyText = (task && task.detail)
    || (task && task.whyKey && t(task.whyKey))
    || null;

  const urgencyLabel = urgency === 'urgent'   ? (tSafe('actionHome.urgency.urgent', ''))
                     : urgency === 'important' ? (tSafe('actionHome.urgency.important', ''))
                     : null;

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

  // Resolved task title — used both for the card heading AND as
  // the Listen button's spoken text (so voice playback always
  // matches the visible copy).
  const titleText = task.title || (task.titleKey ? t(task.titleKey) : '') || '';

  function handleListen() {
    // The whole card (priority + title + why) is what a low-literacy
    // farmer would want to hear. Compose it once and pass to the
    // voice engine — same engine the rest of the app uses, so Twi
    // hits the prerecorded clip path when a key match exists.
    const parts = [];
    if (urgencyLabel) parts.push(urgencyLabel);
    if (titleText)    parts.push(titleText);
    if (whyText)      parts.push(whyText);
    const phrase = parts.filter(Boolean).join('. ');
    if (phrase) speak(phrase, language || 'en');
  }

  return (
    <div
      style={{ ...S.card, ...urgencyStyle.card }}
      data-testid="primary-task-card"
      data-urgency={urgency}
    >
      {/* Priority chip — moved from the top-right corner to a
          dedicated row at the top, with an inline Lucide-style
          AlertCircle icon. Visual restyle only — t() keys
          unchanged. */}
      <div style={S.priorityRow}>
        <span
          style={{ ...S.priorityChip, ...urgencyStyle.badge }}
          data-testid="primary-task-urgency"
        >
          <AlertCircle size={14} />
          <span>{urgencyLabel || t('actionHome.primary.title')}</span>
        </span>
      </div>

      <h2 style={S.title}>{titleText}</h2>

      {/* Pill-shaped "why" / timing chip. Same data as before
          (whyKey or task.detail), just rendered as a single-line
          chip beneath the title — matches the visual reference. */}
      {whyText && (
        <span style={S.whyPill} data-testid="primary-task-why">
          {whyText}
        </span>
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

      {/* Listen row — full-width, sits ABOVE the primary CTA per
          the visual reference. Uses voiceEngine.speak directly so
          we get the same 3-tier (clip → provider TTS → browser TTS)
          fallback as VoiceButton, but with a wider labeled control
          that fits the card layout. Hides itself silently when
          there is nothing to read. */}
      {(titleText || whyText) && (
        <button
          type="button"
          onClick={handleListen}
          style={S.listenBtn}
          data-testid="primary-task-listen"
          aria-label={tSafe('common.listen', 'Listen')}
        >
          <Volume2 size={16} />
          <span style={{ marginLeft: 8 }}>
            {tSafe('common.listen', 'Listen')}
          </span>
        </button>
      )}

      {/* Primary CTA is full-width on its own row (matches the
          green Act Now in the reference). Skip / report buttons
          move to a small secondary row below — still visible, just
          de-emphasised. */}
      <button
        type="button"
        onClick={handleComplete}
        disabled={busy || task.source?.startsWith('override:')}
        style={{ ...S.ctaPrimary, ...(busy ? S.ctaBusy : null) }}
        data-testid="primary-task-complete"
      >
        {busy ? t('actionHome.primary.markingDone') : t('actionHome.primary.markComplete')}
      </button>

      {((onSkip && !task.source?.startsWith('override:')) || onReportIssue) && (
        <div style={S.secondaryRow}>
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
      )}

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

function urgencyStyleFor(code) {
  if (code === 'urgent') return {
    card:  { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.30)' },
    label: { color: '#FCA5A5' },
    badge: { background: 'rgba(239,68,68,0.18)', color: '#FCA5A5' },
  };
  if (code === 'important') return {
    card:  { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.28)' },
    label: { color: '#FDE68A' },
    badge: { background: 'rgba(245,158,11,0.18)', color: '#FDE68A' },
  };
  // 'normal' — default to the existing green "on track" styling.
  return {
    card:  {},
    label: {},
    badge: { background: 'rgba(34,197,94,0.16)', color: '#86EFAC' },
  };
}

const S = {
  card: {
    padding: '1.25rem',
    borderRadius: '20px',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
  },
  // Visual-restyle additions ───────────────────────────────────
  priorityRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '0.625rem',
  },
  priorityChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.625rem',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  whyPill: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(34,197,94,0.18)',
    color: '#86EFAC',
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
    maxWidth: '100%',
  },
  listenBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.625rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: '#1A3B5D',
    color: '#D1D5DB',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
    marginBottom: '0.625rem',
  },
  ctaPrimary: {
    width: '100%',
    padding: '0.9375rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '1.0625rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '56px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  secondaryRow: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.625rem',
  },
  // ─── Pre-existing tokens kept for backward-compat ───────────
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
  title: { fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.5rem', lineHeight: 1.3, color: '#EAF2FF' },
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
  ctaGhost: {
    flex: 1,
    padding: '0.625rem 0.875rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    minHeight: '44px',
  },
  ctaBusy: { opacity: 0.7, cursor: 'wait' },
  ctaHarvest: {
    marginTop: '0.625rem', width: '100%',
    padding: '0.875rem', borderRadius: '14px', border: 'none',
    background: '#F59E0B', color: '#1b1b1f',
    fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px',
  },
};
