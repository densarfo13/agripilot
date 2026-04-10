import React, { useState, useRef, useCallback, useEffect } from 'react';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { enqueue, isOnline } from '../utils/offlineQueue.js';
import api from '../api/client.js';
import VoiceBar from './VoiceBar.jsx';
import { trackVoiceStepCompleted } from '../utils/voiceAnalytics.js';
import useGuaranteedAction, { ACTION_STATE } from '../hooks/useGuaranteedAction.js';
import ActionFeedback from './ActionFeedback.jsx';
import { useTranslation } from '../i18n/index.js';

/**
 * QuickUpdateFlow — 10–20 second, tap-first "Add Update" wizard.
 *
 * Flow paths:
 *   Crop Progress → Stage → Condition → [Photo] → Submit
 *   Upload Photo  → [Stage] → Submit
 *   Report Issue  → Condition(Problem) → [Photo] → Submit
 *
 * No required typing. Every step is a single tap.
 * Offline-safe: queues to IndexedDB if network fails.
 * Duplicate-safe: submitGuardRef + timestamp dedup.
 * Retry-safe: preserves state on failure, one-tap retry.
 */

// ─── Step options ──────────────────────────────────────────

function getActionOptions(t) {
  return [
    { value: 'progress', label: t('quickUpdate.cropProgress'), icon: '🌱', desc: t('quickUpdate.logStageCondition') },
    { value: 'photo', label: t('quickUpdate.uploadPhoto'), icon: '📷', desc: t('quickUpdate.takeAFarmPhoto') },
    { value: 'issue', label: t('quickUpdate.reportIssue'), icon: '⚠️', desc: t('quickUpdate.pestDiseaseWeather') },
  ];
}

function getStageOptions(t) {
  return [
    { value: 'planting', label: t('quickUpdate.planting'), icon: '🌱' },
    { value: 'vegetative', label: t('quickUpdate.growing'), icon: '🌿' },
    { value: 'flowering', label: t('quickUpdate.flowering'), icon: '🌼' },
    { value: 'harvest', label: t('quickUpdate.harvesting'), icon: '🌾' },
  ];
}

function getConditionOptions(t) {
  return [
    { value: 'good', label: t('quickUpdate.good'), icon: '👍', color: '#22C55E' },
    { value: 'average', label: t('quickUpdate.okay'), icon: '👌', color: '#F59E0B' },
    { value: 'poor', label: t('quickUpdate.problem'), icon: '👎', color: '#EF4444' },
  ];
}

const IMAGE_STAGE_MAP = {
  planting: 'early_growth',
  vegetative: 'mid_stage',
  flowering: 'pre_harvest',
  harvest: 'harvest',
};

// Map QuickUpdateFlow steps to voice guide keys (dot-notation)
const STEP_VOICE_KEY = {
  action: 'update.start',
  stage: 'update.chooseStage',
  condition: 'update.condition',
  photo: 'update.takePhoto',
  submitting: 'update.submit',
  done: 'update.success',
  offline: 'update.savedOffline',
  error: 'update.failed',
};

// ─── Photo compression ────────────────────────────────────

const MAX_PHOTO_DIMENSION = 1200;
const PHOTO_QUALITY = 0.7;

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_PHOTO_DIMENSION || height > MAX_PHOTO_DIMENSION) {
        const ratio = Math.min(MAX_PHOTO_DIMENSION / width, MAX_PHOTO_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        PHOTO_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// ─── Main component ────────────────────────────────────────

export default function QuickUpdateFlow({ seasonId, farmerId, onComplete, onCancel, entries }) {
  const [step, setStep] = useState('action'); // action | stage | condition | photo | submitting | done | error | offline
  const [action, setAction] = useState(null);   // progress | photo | issue
  const [stage, setStage] = useState(null);      // planting | vegetative | flowering | harvest
  const [condition, setCondition] = useState(null); // good | average | poor
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const startTime = useRef(Date.now());
  const { t } = useTranslation();

  // ─── Localized option sets (rebuilt on language change) ────
  const ACTION_OPTIONS = getActionOptions(t);
  const STAGE_OPTIONS = getStageOptions(t);
  const CONDITION_OPTIONS = getConditionOptions(t);

  // ─── Guaranteed action for submit ─────────────────────────
  const submitAction = useGuaranteedAction({
    timeoutMs: 12000,
    onOffline: async () => {
      const offlinePayload = {
        method: 'POST',
        url: `/seasons/${seasonId}/progress`,
        data: {
          activityType: action === 'issue' ? 'other' : (stage || 'other'),
          entryType: 'activity',
          entryDate: new Date().toISOString().split('T')[0],
          description: action === 'issue' ? 'Issue reported (offline)' : 'Quick update (offline)',
        },
      };
      await enqueue(offlinePayload);
      trackPilotEvent('quick_update_offline', { farmerId, action });
    },
  });

  // Cleanup photo preview URL
  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  // ─── Navigation helpers ──────────────────────────────────

  const goToStep = useCallback((nextStep) => {
    // Track voice step completion when moving forward
    const voiceKey = STEP_VOICE_KEY[step];
    if (voiceKey) {
      try { const lang = localStorage.getItem('farroway:voiceLang') || 'en'; trackVoiceStepCompleted(voiceKey, lang); } catch {}
    }
    setStep(nextStep);
  }, [step]);

  const handleActionSelect = useCallback((val) => {
    setAction(val);
    if (val === 'progress') {
      goToStep('stage');
    } else if (val === 'photo') {
      // Open camera directly
      goToStep('photo');
    } else if (val === 'issue') {
      // Skip to condition with Problem pre-selected, then photo
      setCondition('poor');
      goToStep('photo');
    }
  }, [goToStep]);

  const handleStageSelect = useCallback((val) => {
    setStage(val);
    goToStep('condition');
  }, [goToStep]);

  const handleConditionSelect = useCallback((val) => {
    setCondition(val);
    // Auto-advance to photo step (optional photo)
    goToStep('photo');
  }, [goToStep]);

  // ─── Photo capture ──────────────────────────────────────

  const handlePhotoCapture = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressPhoto(file);
      setPhotoFile(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
    } catch {
      // If compression fails, use original
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }, []);

  const clearPhoto = useCallback(() => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }, [photoPreview]);

  // ─── Submit (via guaranteed action) ──────────────────────

  const handleSubmit = useCallback(async () => {
    // Photo-only with no file — nothing to submit
    if (action === 'photo' && !photoFile) {
      setStep('action');
      return;
    }

    setStep('submitting');
    setError('');

    await submitAction.run(async () => {
      const elapsed = Math.round((Date.now() - startTime.current) / 1000);
      const isFirstUpdate = entries && entries.length === 0;

      if (action === 'progress' || action === 'issue') {
        const payload = {
          activityType: action === 'issue' ? 'other' : (stage || 'other'),
          entryType: 'activity',
          entryDate: new Date().toISOString().split('T')[0],
          description: action === 'issue' ? 'Issue reported via quick update' : '',
        };

        if (condition) {
          await api.post(`/seasons/${seasonId}/progress`, payload);
          await api.post(`/seasons/${seasonId}/condition`, {
            cropCondition: condition,
            conditionNotes: action === 'issue' ? 'Reported via quick update' : '',
          });
        } else {
          await api.post(`/seasons/${seasonId}/progress`, payload);
        }

        if (stage) {
          await api.post(`/seasons/${seasonId}/stage-confirmation`, {
            confirmedStage: stage,
            note: 'Confirmed via quick update',
          }).catch(() => {});
        }

        if (isFirstUpdate) {
          trackPilotEvent('first_update_submitted', { farmerId, seasonId, via: 'quick_update' });
        }
        trackPilotEvent('update_submitted', { farmerId, seasonId, type: action, elapsed });
      }

      // Upload photo if captured — failure does not fail the whole update
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile, 'quick-update.jpg');
        try {
          const uploadRes = await api.post('/farmers/me/profile-photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (seasonId) {
            const imageUrl = uploadRes.data?.imageUrl || uploadRes.data?.profileImageUrl;
            if (imageUrl) {
              await api.post(`/seasons/${seasonId}/progress-image`, {
                imageUrl,
                imageStage: IMAGE_STAGE_MAP[stage] || 'mid_stage',
                description: action === 'photo' ? 'Quick photo update' : `${action} update photo`,
              }).catch(() => {});
            }
          }
          trackPilotEvent('photo_uploaded', { farmerId, context: 'quick_update' });
        } catch (photoErr) {
          trackPilotEvent('photo_failed', { farmerId, context: 'quick_update', error: photoErr?.message });
        }
      }

      if (action === 'photo' && photoFile && !condition && !stage) {
        trackPilotEvent('update_submitted', { farmerId, seasonId, type: 'photo_only', elapsed });
      }

      trackPilotEvent('quick_update_completed', { farmerId, elapsed, action });
    });

    // Map guaranteed action result to step state
    if (submitAction.isSuccess) setStep('done');
    else if (submitAction.isSavedOffline) setStep('offline');
    else if (submitAction.isRetryable) { setError(submitAction.error); setStep('error'); }
    else if (submitAction.isError) { setError(submitAction.error); setStep('error'); }
  }, [action, stage, condition, photoFile, seasonId, farmerId, entries, submitAction]);

  // ─── Render helpers ──────────────────────────────────────

  const renderStepIndicator = () => {
    const steps = action === 'photo' ? 2 : action === 'issue' ? 3 : 4;
    const currentMap = { action: 1, stage: 2, condition: 3, photo: action === 'photo' ? 2 : action === 'issue' ? 3 : 4 };
    const current = currentMap[step] || steps;
    return (
      <div style={QS.stepIndicator} data-testid="quick-step-indicator">
        {Array.from({ length: steps }, (_, i) => (
          <div key={i} style={{
            ...QS.stepDot,
            background: i < current ? '#22C55E' : '#243041',
          }} />
        ))}
      </div>
    );
  };

  // ─── Step: Action Selection ──────────────────────────────

  // Current voice key based on step
  const voiceKey = STEP_VOICE_KEY[step] || null;

  if (step === 'action') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <div style={QS.header}>
          <button onClick={onCancel} style={QS.backBtn} aria-label="Close">✕</button>
          <span style={QS.title}>{t('update.addUpdate')}</span>
          <div style={{ width: 44 }} />
        </div>
        {renderStepIndicator()}
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.stepTitle}>{t('update.whatToDo')}</div>
        <div style={QS.optionGrid} data-testid="action-select">
          {ACTION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleActionSelect(opt.value)}
              style={QS.actionCard}
              data-testid={`action-${opt.value}`}
            >
              <span style={QS.actionIcon}>{opt.icon}</span>
              <span style={QS.actionLabel}>{opt.label}</span>
              <span style={QS.actionDesc}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step: Stage Selection ───────────────────────────────

  if (step === 'stage') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <div style={QS.header}>
          <button onClick={() => goToStep('action')} style={QS.backBtn} aria-label="Back">←</button>
          <span style={QS.title}>{t('update.cropStage')}</span>
          <div style={{ width: 44 }} />
        </div>
        {renderStepIndicator()}
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.stepTitle}>{t('update.whatStage')}</div>
        <div style={QS.stageGrid} data-testid="stage-select">
          {STAGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStageSelect(opt.value)}
              style={{
                ...QS.stageCard,
                border: stage === opt.value ? '3px solid #22C55E' : '2px solid #243041',
                background: stage === opt.value ? 'rgba(34,197,94,0.1)' : '#162033',
              }}
              data-testid={`stage-${opt.value}`}
            >
              <span style={QS.stageIcon}>{opt.icon}</span>
              <span style={QS.stageLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step: Condition ─────────────────────────────────────

  if (step === 'condition') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <div style={QS.header}>
          <button onClick={() => goToStep('stage')} style={QS.backBtn} aria-label="Back">←</button>
          <span style={QS.title}>{t('update.condition')}</span>
          <div style={{ width: 44 }} />
        </div>
        {renderStepIndicator()}
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.stepTitle}>{t('update.howLook')}</div>
        <div style={QS.conditionRow} data-testid="condition-select">
          {CONDITION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleConditionSelect(opt.value)}
              style={{
                ...QS.conditionCard,
                border: condition === opt.value ? `3px solid ${opt.color}` : '2px solid #243041',
                background: condition === opt.value ? `${opt.color}15` : '#162033',
              }}
              data-testid={`condition-${opt.value}`}
            >
              <span style={QS.conditionIcon}>{opt.icon}</span>
              <span style={{ ...QS.conditionLabel, color: opt.color }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step: Photo (optional) ──────────────────────────────

  if (step === 'photo') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <div style={QS.header}>
          <button onClick={() => {
            if (action === 'progress') goToStep('condition');
            else if (action === 'issue') goToStep('action');
            else goToStep('action');
          }} style={QS.backBtn} aria-label="Back">←</button>
          <span style={QS.title}>{t('update.photo')}</span>
          <div style={{ width: 44 }} />
        </div>
        {renderStepIndicator()}
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.stepTitle}>
          {action === 'photo' ? t('update.takePhotoOfFarm') : t('update.addPhotoOptional')}
        </div>
        <div style={QS.photoArea} data-testid="photo-step">
          {photoPreview ? (
            <div style={QS.previewWrap}>
              <img src={photoPreview} alt="Preview" style={QS.previewImg} />
              <button onClick={clearPhoto} style={QS.removePhotoBtn}>{'✕ '}{t('update.remove')}</button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={QS.captureBtn}
              data-testid="capture-photo-btn"
            >
              <span style={{ fontSize: '2.5rem' }}>📷</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('update.tapToTakePhoto')}</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            style={{ display: 'none' }}
            data-testid="photo-input"
          />
        </div>
        {/* Submit button */}
        <button
          onClick={handleSubmit}
          style={{
            ...QS.submitBtn,
            opacity: (action === 'photo' && !photoFile) ? 0.5 : 1,
          }}
          disabled={action === 'photo' && !photoFile}
          data-testid="submit-update-btn"
        >
          {action === 'photo' ? t('update.savePhoto') : photoFile ? t('update.submitWithPhoto') : t('update.submitUpdate')}
        </button>
        {action !== 'photo' && !photoFile && (
          <button onClick={handleSubmit} style={QS.skipBtn} data-testid="skip-photo-btn">
            {t('update.skipPhoto')} →
          </button>
        )}
      </div>
    );
  }

  // ─── Step: Submitting ────────────────────────────────────

  if (step === 'submitting') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <ActionFeedback
          state={ACTION_STATE.LOADING}
          stillWorking={submitAction.stillWorking}
          loadingText={t('update.savingUpdate')}
          compact
        />
      </div>
    );
  }

  // ─── Step: Success ───────────────────────────────────────

  if (step === 'done') {
    const elapsed = Math.round((Date.now() - startTime.current) / 1000);
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <VoiceBar voiceKey={voiceKey} compact />
        <ActionFeedback
          state={ACTION_STATE.SUCCESS}
          successText={t('update.updateSaved')}
          nextStepText={t('update.completedIn', { seconds: elapsed })}
          onDone={() => onComplete?.()}
        />
      </div>
    );
  }

  // ─── Step: Offline ───────────────────────────────────────

  if (step === 'offline') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <VoiceBar voiceKey={voiceKey} compact />
        <ActionFeedback
          state={ACTION_STATE.SAVED_OFFLINE}
          offlineText={t('update.savedOffline')}
          message={t('update.willSyncReconnect')}
          onDone={() => onComplete?.()}
        />
      </div>
    );
  }

  // ─── Step: Error + Retry ─────────────────────────────────

  if (step === 'error') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <VoiceBar voiceKey={voiceKey} compact />
        <ActionFeedback
          state={submitAction.isRetryable ? ACTION_STATE.RETRYABLE : ACTION_STATE.ERROR}
          error={error}
          onRetry={handleSubmit}
          onCancel={onCancel}
        />
      </div>
    );
  }

  return null;
}

// ─── Styles ────────────────────────────────────────────────

const QS = {
  container: {
    minHeight: '400px', display: 'flex', flexDirection: 'column',
    background: '#0F172A', borderRadius: '12px', padding: '1rem',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  backBtn: {
    width: '44px', height: '44px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'transparent', border: '1px solid #243041',
    borderRadius: '10px', color: '#FFFFFF', fontSize: '1.1rem', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent', minHeight: '44px',
  },
  title: { fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' },

  // Step indicator
  stepIndicator: {
    display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '1rem',
  },
  stepDot: {
    width: '8px', height: '8px', borderRadius: '50%', transition: 'background 0.2s',
  },

  stepTitle: {
    fontSize: '1.1rem', fontWeight: 600, color: '#FFFFFF', textAlign: 'center',
    marginBottom: '1.25rem',
  },

  // Action cards
  optionGrid: {
    display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', flex: 1,
  },
  actionCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.25rem',
    padding: '1.25rem 1rem', background: '#162033', border: '2px solid #243041',
    borderRadius: '14px', cursor: 'pointer', color: '#FFFFFF',
    minHeight: '80px', WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, transform 0.1s',
  },
  actionIcon: { fontSize: '2rem' },
  actionLabel: { fontSize: '1rem', fontWeight: 700 },
  actionDesc: { fontSize: '0.8rem', color: '#A1A1AA' },

  // Stage cards (2x2 grid)
  stageGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', flex: 1,
  },
  stageCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.4rem',
    padding: '1.5rem 1rem', borderRadius: '14px', cursor: 'pointer',
    color: '#FFFFFF', minHeight: '100px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, transform 0.1s',
  },
  stageIcon: { fontSize: '2.5rem' },
  stageLabel: { fontSize: '1rem', fontWeight: 700 },

  // Condition cards
  conditionRow: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', flex: 1,
  },
  conditionCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.5rem',
    padding: '1.5rem 0.5rem', borderRadius: '14px', cursor: 'pointer',
    color: '#FFFFFF', minHeight: '120px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, transform 0.1s',
  },
  conditionIcon: { fontSize: '2.5rem' },
  conditionLabel: { fontSize: '1rem', fontWeight: 700 },

  // Photo
  photoArea: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '200px',
  },
  captureBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.5rem',
    width: '100%', maxWidth: '280px', padding: '2rem',
    background: '#162033', border: '2px dashed #243041', borderRadius: '14px',
    color: '#FFFFFF', cursor: 'pointer', minHeight: '140px',
    WebkitTapHighlightColor: 'transparent',
  },
  previewWrap: {
    position: 'relative', width: '100%', maxWidth: '300px',
    borderRadius: '12px', overflow: 'hidden',
  },
  previewImg: {
    width: '100%', height: 'auto', display: 'block', borderRadius: '12px',
    maxHeight: '250px', objectFit: 'cover',
  },
  removePhotoBtn: {
    position: 'absolute', top: '8px', right: '8px',
    padding: '0.4rem 0.8rem', background: 'rgba(0,0,0,0.7)', color: '#FFFFFF',
    border: 'none', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer',
    minHeight: '36px',
  },

  // Submit
  submitBtn: {
    width: '100%', padding: '1rem', marginTop: '1rem',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    color: '#FFFFFF', border: 'none', borderRadius: '14px',
    fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer',
    minHeight: '56px', WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
  },
  skipBtn: {
    width: '100%', padding: '0.75rem', marginTop: '0.5rem',
    background: 'transparent', color: '#A1A1AA', border: 'none',
    fontSize: '0.9rem', cursor: 'pointer', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },

  // Feedback states
  feedbackCenter: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', padding: '2rem 1rem',
    minHeight: '300px',
  },
  feedbackIcon: { fontSize: '3rem', marginBottom: '0.75rem' },
  feedbackTitle: { fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.5rem' },
  feedbackSub: { fontSize: '0.9rem', color: '#A1A1AA', marginBottom: '1.5rem', lineHeight: 1.5 },
  doneBtn: {
    padding: '0.85rem 2.5rem', background: '#22C55E', color: '#FFFFFF',
    border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer', minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
  },
  retryBtn: {
    padding: '0.85rem 2.5rem', background: '#F59E0B', color: '#FFFFFF',
    border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer', minHeight: '52px', marginBottom: '0.5rem',
    WebkitTapHighlightColor: 'transparent',
  },

  // Spinner
  spinner: {
    width: '40px', height: '40px', border: '4px solid #243041',
    borderTopColor: '#22C55E', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', marginBottom: '1rem',
  },
};
