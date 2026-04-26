import React from 'react';
import { ACTION_STATE } from '../hooks/useGuaranteedAction.js';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';

/**
 * ActionFeedback — standardized UI for guarantee-layer states.
 *
 * Shows consistent, mobile-friendly, low-literacy-friendly messaging for:
 *   loading, success, error, retryable, saved_offline
 *
 * Props:
 *   state          — from useGuaranteedAction
 *   error          — error message
 *   message        — success/info message
 *   stillWorking   — boolean, show "still working" after delay
 *   onRetry        — retry handler
 *   onDone         — done/continue handler
 *   onCancel       — optional cancel handler
 *   loadingText    — custom loading text (default: "Saving...")
 *   successText    — custom success text (default: "Done!")
 *   offlineText    — custom offline text (default: "Saved offline")
 *   nextStepText   — what to do next after success
 *   compact        — smaller layout
 */
export default function ActionFeedback({
  state,
  error,
  message,
  stillWorking,
  onRetry,
  onDone,
  onCancel,
  loadingText = 'Saving...',
  successText = 'Done!',
  offlineText = 'Saved offline',
  nextStepText,
  compact,
}) {
  const { t } = useTranslation();

  if (state === ACTION_STATE.IDLE) return null;

  const S = compact ? compactStyles : styles;

  // ─── Loading ────────────────────────────────────────────
  if (state === ACTION_STATE.LOADING) {
    return (
      <div style={S.center} data-testid="action-feedback-loading">
        <div style={S.spinner} />
        <div style={S.title}>{stillWorking ? t('feedback.stillWorking') : loadingText}</div>
        {stillWorking && <div style={S.sub}>{t('feedback.pleaseWait')}</div>}
      </div>
    );
  }

  // ─── Success ────────────────────────────────────────────
  if (state === ACTION_STATE.SUCCESS) {
    return (
      <div style={S.center} data-testid="action-feedback-success">
        <span style={S.icon}>✅</span>
        <div style={S.title}>{message || successText}</div>
        {nextStepText && <div style={S.sub}>{nextStepText}</div>}
        {onDone && (
          <button onClick={onDone} style={S.primaryBtn} data-testid="action-done-btn">
            {t('feedback.continue')}
          </button>
        )}
      </div>
    );
  }

  // ─── Saved offline ──────────────────────────────────────
  if (state === ACTION_STATE.SAVED_OFFLINE) {
    return (
      <div style={S.center} data-testid="action-feedback-offline">
        <span style={S.icon}>📡</span>
        <div style={S.title}>{offlineText}</div>
        <div style={S.sub}>{message || t('feedback.willSync')}</div>
        {onDone && (
          <button onClick={onDone} style={S.primaryBtn}>
            {t('feedback.okay')}
          </button>
        )}
      </div>
    );
  }

  // ─── Retryable error ────────────────────────────────────
  if (state === ACTION_STATE.RETRYABLE) {
    return (
      <div style={S.center} data-testid="action-feedback-retryable">
        <span style={S.icon}>⚠️</span>
        <div style={S.title}>{t('feedback.couldNotComplete')}</div>
        <div style={S.sub}>{error || t('feedback.tryAgain')}</div>
        {onRetry && (
          <button onClick={onRetry} style={S.retryBtn} data-testid="action-retry-btn">
            {t('common.retry')}
          </button>
        )}
        {onCancel && (
          <button onClick={onCancel} style={S.cancelBtn}>
            {t('common.cancel')}
          </button>
        )}
      </div>
    );
  }

  // ─── Non-retryable error ────────────────────────────────
  if (state === ACTION_STATE.ERROR) {
    return (
      <div style={S.center} data-testid="action-feedback-error">
        <span style={S.icon}>❌</span>
        <div style={S.title}>{t('feedback.somethingWrong')}</div>
        <div style={S.sub}>{error}</div>
        {onCancel && (
          <button onClick={onCancel} style={S.cancelBtn}>
            {t('feedback.goBack')}
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ─── Styles ──────────────────────────────────────────────

const styles = {
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.5rem', padding: '2rem 1rem',
    textAlign: 'center', minHeight: '200px',
  },
  icon: { fontSize: '2.5rem' },
  title: { fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF' },
  sub: { fontSize: '0.9rem', color: '#A1A1AA', maxWidth: '300px', lineHeight: 1.5 },
  spinner: {
    width: '36px', height: '36px', border: '3px solid #243041',
    borderTopColor: '#22C55E', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  primaryBtn: {
    marginTop: '0.75rem', padding: '0.75rem 2rem', background: '#22C55E',
    color: '#000', border: 'none', borderRadius: '12px', fontSize: '1rem',
    fontWeight: 700, cursor: 'pointer', minHeight: '48px', minWidth: '160px',
    WebkitTapHighlightColor: 'transparent',
  },
  retryBtn: {
    marginTop: '0.75rem', padding: '0.75rem 2rem', background: '#F59E0B',
    color: '#000', border: 'none', borderRadius: '12px', fontSize: '1rem',
    fontWeight: 700, cursor: 'pointer', minHeight: '48px', minWidth: '160px',
    WebkitTapHighlightColor: 'transparent',
  },
  cancelBtn: {
    marginTop: '0.5rem', padding: '0.5rem 1.5rem', background: 'transparent',
    color: '#A1A1AA', border: '1px solid #374151', borderRadius: '10px',
    fontSize: '0.9rem', cursor: 'pointer', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
};

const compactStyles = {
  ...styles,
  center: { ...styles.center, minHeight: '120px', padding: '1rem' },
  icon: { fontSize: '1.75rem' },
  title: { ...styles.title, fontSize: '1rem' },
  sub: { ...styles.sub, fontSize: '0.85rem' },
};
