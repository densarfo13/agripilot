/**
 * ActionFeedbackBanner — instant visual feedback after farmer actions.
 *
 * States:
 *   success   — "Saved ✅"
 *   offline   — "Saved offline 🟡"
 *   syncing   — "Syncing…"
 *   synced    — "Synced ✅"
 *   failed    — "Failed — Tap to retry"
 *
 * Auto-hides after timeout. Uses farmer-friendly wording (no jargon).
 * Optional haptic feedback on success (navigator.vibrate).
 */
import { useEffect } from 'react';
import { useTranslation } from '../i18n/index.js';

/**
 * @param {'success'|'offline'|'syncing'|'synced'|'failed'} status
 * @param {Function} onDismiss - called when banner should hide
 * @param {Function} onRetry - called when user taps retry (failed state)
 * @param {number} autoHideMs - auto-hide delay (default 2500ms, 0 = no auto-hide)
 */
export default function ActionFeedbackBanner({ status, message, onDismiss, onRetry, autoHideMs = 2500 }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!status) return;
    // Haptic feedback on success/offline save
    if ((status === 'success' || status === 'offline') && navigator.vibrate) {
      try { navigator.vibrate(50); } catch { /* unsupported */ }
    }
    // Auto-hide (not for failed — user needs to see retry)
    if (autoHideMs > 0 && status !== 'failed' && status !== 'syncing') {
      const timer = setTimeout(() => onDismiss?.(), autoHideMs);
      return () => clearTimeout(timer);
    }
  }, [status, autoHideMs, onDismiss]);

  if (!status) return null;

  const config = BANNER_CONFIG[status] || BANNER_CONFIG.success;

  return (
    <div
      style={{ ...S.banner, background: config.bg, borderColor: config.border }}
      data-testid={`feedback-${status}`}
      onClick={status === 'failed' ? onRetry : onDismiss}
      role={status === 'failed' ? 'button' : 'status'}
    >
      <span style={S.icon}>{config.icon}</span>
      <span style={{ ...S.text, color: config.textColor }}>{message || t(config.labelKey)}</span>
      {status === 'failed' && (
        <span style={S.retryHint}>{t('feedback.tapRetry')}</span>
      )}
    </div>
  );
}

const BANNER_CONFIG = {
  success: {
    icon: '✅',
    labelKey: 'feedback.saved',
    bg: 'rgba(34,197,94,0.06)',
    border: 'rgba(34,197,94,0.12)',
    textColor: '#9FB3C8',
  },
  offline: {
    icon: '🟡',
    labelKey: 'feedback.savedOffline',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.12)',
    textColor: '#FCD34D',
  },
  syncing: {
    icon: '🔄',
    labelKey: 'feedback.syncing',
    bg: 'rgba(14,165,233,0.06)',
    border: 'rgba(14,165,233,0.12)',
    textColor: '#7DD3FC',
  },
  synced: {
    icon: '✅',
    labelKey: 'feedback.synced',
    bg: 'rgba(34,197,94,0.06)',
    border: 'rgba(34,197,94,0.12)',
    textColor: '#9FB3C8',
  },
  failed: {
    icon: '❌',
    labelKey: 'feedback.failed',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.14)',
    textColor: '#FCA5A5',
  },
};

const S = {
  banner: {
    borderRadius: '14px',
    border: '1px solid',
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    animation: 'farroway-fadeIn 0.2s ease',
  },
  icon: {
    fontSize: '1.1rem',
    flexShrink: 0,
  },
  text: {
    fontSize: '0.875rem',
    fontWeight: 700,
  },
  retryHint: {
    fontSize: '0.75rem',
    color: '#6F8299',
    marginLeft: 'auto',
    fontWeight: 500,
  },
};
