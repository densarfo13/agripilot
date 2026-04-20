/**
 * TaskFeedbackModal — lightweight "Did this help?" prompt shown
 * after a farmer marks a task complete.
 *
 *   <TaskFeedbackModal
 *      open={bool}
 *      taskId={string}
 *      onAnswer={(value /* 'yes' | 'no' *\/) => void}
 *      onClose={() => void}
 *   />
 *
 * Non-blocking: no submit button, no required fields. A single tap
 * on Yes or No records the feedback and dismisses; tapping outside
 * also dismisses without recording. Keeps the Today flow fast.
 *
 * Localized via the existing AppSettingsContext so the whole screen
 * stays in ONE language.
 */
import { useAppSettings } from '../../context/AppSettingsContext.jsx';

export default function TaskFeedbackModal({ open, taskId, onAnswer, onClose }) {
  const { t } = useAppSettings();
  if (!open) return null;

  const titleLbl = (t && t('actionHome.feedback.didThisHelp')) || 'Did this help?';
  const yesLbl   = (t && t('common.yes')) || 'Yes';
  const noLbl    = (t && t('common.no'))  || 'No';

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  function pick(value) {
    try { onAnswer?.(value); } finally { onClose?.(); }
  }

  return (
    <div
      style={S.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-feedback-title"
      onClick={handleBackdrop}
      data-testid="task-feedback-modal"
      data-task-id={taskId || ''}
    >
      <div style={S.sheet}>
        <h2 id="task-feedback-title" style={S.title}>{titleLbl}</h2>
        <div style={S.ctaRow}>
          <button
            type="button"
            onClick={() => pick('yes')}
            style={S.btnPrimary}
            data-testid="task-feedback-yes"
          >
            {yesLbl}
          </button>
          <button
            type="button"
            onClick={() => pick('no')}
            style={S.btnGhost}
            data-testid="task-feedback-no"
          >
            {noLbl}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 90,
  },
  sheet: {
    width: '100%', maxWidth: '480px',
    background: '#14171f',
    borderRadius: '20px 20px 0 0',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    color: '#EAF2FF',
  },
  title: { margin: 0, fontSize: '1.125rem', fontWeight: 700 },
  ctaRow: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' },
  btnPrimary: {
    flex: 1, padding: '0.875rem', borderRadius: '14px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '52px',
  },
  btnGhost: {
    flex: 1, padding: '0.875rem', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
    minHeight: '52px',
  },
};
