/**
 * CompletionBanner — lightweight positive-reinforcement banner that
 * appears briefly after a task is marked complete.
 *
 *   <CompletionBanner
 *     open={bool}
 *     onClose={() => void}
 *     autoHideMs={2500}           // default auto-dismiss
 *     messageKey="actionHome.completion.positive"
 *   />
 *
 * Non-blocking: no buttons, no required action. Purely supportive.
 * Pairs with TaskFeedbackModal which asks "Did this help?" right
 * after. The banner shows first (reward), the modal follows for
 * optional input — both can be dismissed without blocking flow.
 */
import { useEffect } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function CompletionBanner({
  open,
  onClose,
  autoHideMs = 2500,
  messageKey = 'actionHome.completion.positive',
}) {
  const { t } = useAppSettings();

  useEffect(() => {
    if (!open || !autoHideMs) return;
    const id = setTimeout(() => { onClose?.(); }, autoHideMs);
    return () => clearTimeout(id);
  }, [open, autoHideMs, onClose]);

  if (!open) return null;

  const message = t(messageKey) || 'Good job — this keeps your farm on track';

  return (
    <div
      style={S.banner}
      role="status"
      aria-live="polite"
      data-testid="completion-banner"
    >
      <span style={S.icon} aria-hidden="true">{'\u2705'}</span>
      <span style={S.text}>{message}</span>
    </div>
  );
}

const S = {
  banner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.28)',
    color: '#86EFAC',
    fontSize: '0.9375rem',
    fontWeight: 600,
    animation: 'farroway-fade-in 0.25s ease-out',
  },
  icon: { fontSize: '1.125rem', lineHeight: 1 },
  text: { flex: 1, lineHeight: 1.3 },
};
