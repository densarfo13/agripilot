/**
 * CropStageModal — tap-to-save modal for updating a farm's crop stage.
 *
 * Tap a stage → auto-saves immediately (no Save button needed).
 * Shows inline success/error feedback (no blocking alerts).
 * Large touch targets (48px+), 2-column grid for farmer usability.
 * Saves via PATCH /api/v2/farm-profile/:id/stage (Zod-validated).
 * Dark theme, low-literacy friendly.
 */

import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { saveCropStage } from '../services/cropStageService.js';
import { STAGES, STAGE_KEYS } from '../utils/cropStages.js';

export default function CropStageModal({ farm, onClose, onSaved }) {
  const { refreshProfile } = useProfile();
  const { isOnline } = useNetwork();
  const { t } = useTranslation();

  const currentStage = farm?.cropStage || 'planning';
  const [selected, setSelected] = useState(currentStage);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }
  const feedbackTimer = useRef(null);

  // Cleanup feedback timer on unmount
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  // ─── Tap = auto-save ─────────────────────────────────────
  async function handleTapStage(stage) {
    if (saving) return;
    if (stage.value === selected && stage.value === currentStage) return; // no change

    setSelected(stage.value);
    setSaving(true);
    setFeedback(null);

    // Haptic feedback
    if (navigator.vibrate) try { navigator.vibrate(50); } catch {}

    const result = await saveCropStage(farm.id, stage.value, { isOnline, refreshProfile });
    const stageName = t(STAGE_KEYS[stage.value]) || stage.value;

    if (result.success) {
      const msg = result.offline
        ? (t('cropStage.savedOffline') || 'Saved locally.')
        : `${t('cropStage.saved') || 'Saved!'} ${stageName}`;
      setFeedback({ type: 'success', message: msg });
      feedbackTimer.current = setTimeout(() => {
        if (onSaved) onSaved(stage.value);
        onClose();
      }, result.offline ? 1200 : 1500);
    } else {
      setFeedback({ type: 'error', message: result.error || t('cropStage.saveFailed') || 'Failed to save. Try again.' });
      setSelected(currentStage);
    }

    setSaving(false);
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()} data-testid="crop-stage-modal">
        <h2 style={S.title}>{t('cropStage.title') || 'Where is your crop now?'}</h2>
        <p style={S.subtitle}>{t('cropStage.subtitle') || 'Tap your current stage'}</p>

        {/* Inline feedback banner */}
        {feedback && (
          <div style={feedback.type === 'success' ? S.successBanner : S.errorBanner}>
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* 2-column grid with large touch targets */}
        <div style={S.stageGrid}>
          {STAGES.map((s) => {
            const isActive = selected === s.value;
            const isSaving = saving && selected === s.value;
            return (
              <button
                key={s.value}
                onClick={() => handleTapStage(s)}
                disabled={saving}
                aria-label={t(STAGE_KEYS[s.value]) || s.value}
                style={{
                  ...S.stageBtn,
                  ...(isActive ? S.stageBtnActive : {}),
                  ...(isSaving ? S.stageBtnSaving : {}),
                }}
                data-testid={`stage-${s.value}`}
              >
                <span style={S.stageIcon}>{s.icon}</span>
                <span style={{
                  ...S.stageLabel,
                  ...(isActive ? S.stageLabelActive : {}),
                }}>
                  {t(STAGE_KEYS[s.value])}
                </span>
                {isSaving && <span style={S.savingDot}>...</span>}
              </button>
            );
          })}
        </div>

        {/* Saving indicator */}
        {saving && (
          <p style={S.savingText}>{t('common.saving') || 'Saving...'}</p>
        )}

        {/* Cancel */}
        <button onClick={onClose} style={S.cancelBtn} disabled={saving}>
          {t('common.cancel') || 'Cancel'}
        </button>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '0',
  },
  modal: {
    width: '100%',
    maxWidth: '30rem',
    background: '#1B2330',
    borderRadius: '20px 20px 0 0',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.15)',
    borderBottom: 'none',
    maxHeight: '90vh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 0.25rem 0',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    margin: '0 0 1rem 0',
    textAlign: 'center',
  },
  // ─── Feedback banners (inline, non-blocking) ────────
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#86EFAC',
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  // ─── 2-column grid with large buttons ───────────────
  stageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.625rem',
    marginBottom: '1rem',
  },
  stageBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '1rem 0.75rem',
    borderRadius: '14px',
    border: '2px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    cursor: 'pointer',
    minHeight: '80px',
    position: 'relative',
    transition: 'transform 0.1s, background 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  stageBtnActive: {
    background: 'rgba(34,197,94,0.18)',
    border: '2px solid #22C55E',
    transform: 'scale(1.03)',
  },
  stageBtnSaving: {
    opacity: 0.7,
  },
  stageIcon: {
    fontSize: '1.75rem',
  },
  stageLabel: {
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 1.3,
    fontWeight: 600,
  },
  stageLabelActive: {
    color: '#86EFAC',
    fontWeight: 700,
  },
  savingDot: {
    position: 'absolute',
    top: '0.375rem',
    right: '0.5rem',
    fontSize: '0.75rem',
    color: '#86EFAC',
    fontWeight: 700,
  },
  savingText: {
    textAlign: 'center',
    color: '#86EFAC',
    fontSize: '0.875rem',
    fontWeight: 600,
    margin: '0 0 0.75rem 0',
  },
  cancelBtn: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
  },
};
