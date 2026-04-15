/**
 * TaskActionModal — minimal task completion screen.
 *
 * Shows: icon + title + voice + Done + Skip
 * No description paragraphs, no priority badge, no reason text.
 * Explanation lives in voice only.
 */
import { getTaskIcon, getTaskIconBg, getTaskVoiceKey } from '../lib/taskPresentation.js';
import VoicePromptButton from './VoicePromptButton.jsx';
import { getPromptText } from '../services/voicePrompts.js';

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
  const voiceKey = getTaskVoiceKey(task);
  const voiceText = getPromptText(voiceKey, 'en') || task.title;

  return (
    <div style={S.overlay} onClick={onClose} data-testid="task-action-modal">
      <div style={S.card} onClick={(e) => e.stopPropagation()}>

        {/* Task icon */}
        <div style={{ ...S.iconCircle, background: iconBg }}>
          <span style={S.iconEmoji}>{icon}</span>
        </div>

        {/* Task title only — no description, no reason */}
        <h2 style={S.title}>{task.title}</h2>

        {/* Voice — explanation lives here, not as text */}
        <VoicePromptButton promptId={voiceKey} text={voiceText} label={t('common.listen')} />

        {/* Done (green, primary) */}
        <button
          type="button"
          onClick={() => onComplete(task)}
          disabled={completing}
          style={{ ...S.doneBtn, ...(completing ? S.doneBtnDisabled : {}) }}
          data-testid="task-action-cta"
        >
          {completing ? (
            <span style={S.btnContent}>
              <span style={S.spinner} />
              {t('common.saving')}
            </span>
          ) : (
            getActionLabel(task.actionType, t)
          )}
        </button>

        {/* Skip (grey, secondary) */}
        <button
          type="button"
          onClick={onClose}
          disabled={completing}
          style={S.skipBtn}
        >
          {t('taskAction.skip')}
        </button>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)', zIndex: 1100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%', maxWidth: '22rem',
    background: '#1B2330', borderRadius: '20px',
    padding: '2rem 1.5rem',
    border: '1px solid rgba(255,255,255,0.12)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', gap: '0.75rem',
  },
  iconCircle: {
    width: '80px', height: '80px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: '2.5rem', lineHeight: 1 },
  title: {
    fontSize: '1.25rem', fontWeight: 700, color: '#fff',
    margin: 0, lineHeight: 1.3, maxWidth: '18rem',
  },
  doneBtn: {
    width: '100%', padding: '1rem',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    color: '#fff', border: 'none', borderRadius: '14px',
    fontSize: '1.0625rem', fontWeight: 800, cursor: 'pointer',
    minHeight: '56px',
    boxShadow: '0 4px 16px rgba(22,163,74,0.25)',
    WebkitTapHighlightColor: 'transparent',
    marginTop: '0.25rem',
  },
  doneBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  btnContent: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
  },
  spinner: {
    display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
    animation: 'farroway-spin 0.6s linear infinite',
  },
  skipBtn: {
    padding: '0.75rem 1.5rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
};
