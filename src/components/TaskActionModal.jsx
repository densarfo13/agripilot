/**
 * TaskActionModal — full-screen modal for completing the current task.
 *
 * Shows when farmer taps "Do this now" on a task.
 * Displays task icon, details, priority badge, voice button,
 * and a big CTA button with action label.
 * Parent handles success state after completion.
 */
import { getTaskIcon, getTaskIconBg, getTaskVoiceKey, getPriorityColors } from '../lib/taskPresentation.js';
import VoicePromptButton from './VoicePromptButton.jsx';

function getActionLabel(actionType, t) {
  switch (actionType) {
    case 'watering':  return t('taskAction.iWatered');
    case 'planting':  return t('taskAction.iPlanted');
    case 'spraying':  return t('taskAction.iSprayed');
    case 'harvest':   return t('taskAction.iHarvested');
    default:          return t('taskAction.markDone');
  }
}

export default function TaskActionModal({ task, onComplete, onClose, completing, t }) {
  if (!task) return null;

  const icon = getTaskIcon(task);
  const iconBg = getTaskIconBg(task);
  const pColors = getPriorityColors(task.priority);
  const voiceKey = getTaskVoiceKey(task);
  const voiceText = t(voiceKey) !== voiceKey ? t(voiceKey) : task.title;

  return (
    <div style={S.overlay} onClick={onClose} data-testid="task-action-modal">
      <div style={S.card} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={completing}
          style={S.closeBtn}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Task icon (large) */}
        <div style={{ ...S.iconCircle, background: iconBg }}>
          <span style={S.iconEmoji}>{icon}</span>
        </div>

        {/* Priority badge */}
        <span
          style={{
            ...S.priorityBadge,
            color: pColors.text,
            background: pColors.bg,
          }}
        >
          {task.priority === 'high'
            ? t('farmTasks.priorityHigh')
            : task.priority === 'medium'
              ? t('farmTasks.priorityMedium')
              : t('farmTasks.priorityLow')}
        </span>

        {/* Task title */}
        <h2 style={S.title}>{task.title}</h2>

        {/* Description */}
        {task.description && (
          <p style={S.description}>{task.description}</p>
        )}

        {/* Reason */}
        {task.reason && (
          <p style={S.reason}>
            <span style={S.reasonIcon}>{'💡'}</span>
            {task.reason}
          </p>
        )}

        {/* Voice button — replay guidance */}
        <VoicePromptButton text={voiceText} label={t('common.listen')} />

        {/* CTA button */}
        <button
          type="button"
          onClick={() => onComplete(task)}
          disabled={completing}
          style={{
            ...S.ctaBtn,
            ...(completing ? S.ctaBtnDisabled : {}),
          }}
          data-testid="task-action-cta"
        >
          {completing ? (
            <span style={S.ctaContent}>
              <span style={S.spinner} />
              {t('common.saving') || 'Saving...'}
            </span>
          ) : (
            getActionLabel(task.actionType, t)
          )}
        </button>

        {/* Skip / close */}
        <button
          type="button"
          onClick={onClose}
          disabled={completing}
          style={S.skipBtn}
        >
          {t('taskAction.skip') || 'Skip'}
        </button>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '24rem',
    background: '#1B2330',
    borderRadius: '20px',
    padding: '2rem 1.5rem',
    border: '1px solid rgba(255,255,255,0.12)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '0.5rem',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '1.125rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  iconCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.5rem',
  },
  iconEmoji: {
    fontSize: '2.5rem',
    lineHeight: 1,
  },
  priorityBadge: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    marginBottom: '0.25rem',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 0.25rem 0',
    lineHeight: 1.3,
  },
  description: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    margin: '0 0 0.5rem 0',
    lineHeight: 1.5,
  },
  reason: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.375rem',
    fontSize: '0.75rem',
    color: '#FDE68A',
    lineHeight: 1.4,
    margin: '0 0 0.5rem 0',
    textAlign: 'left',
  },
  reasonIcon: {
    flexShrink: 0,
    fontSize: '0.75rem',
  },
  ctaBtn: {
    width: '100%',
    padding: '1rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '1.0625rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.5rem',
    marginBottom: '0.5rem',
    transition: 'opacity 0.15s, transform 0.1s',
  },
  ctaBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  ctaContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    animation: 'farroway-spin 0.6s linear infinite',
  },
  skipBtn: {
    padding: '0.625rem 1.5rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
};
