import React, { useState, useRef, useCallback, useEffect } from 'react';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { enqueue, isOnline } from '../utils/offlineQueue.js';
import { getIdempotencyKey } from '../lib/idempotency.js';
import api from '../api/client.js';
import VoiceBar from './VoiceBar.jsx';
import { trackVoiceStepCompleted } from '../utils/voiceAnalytics.js';
import useGuaranteedAction, { ACTION_STATE } from '../hooks/useGuaranteedAction.js';
import ActionFeedback from './ActionFeedback.jsx';
import { useTranslation } from '../i18n/index.js';

/**
 * QuickUpdateFlow — frictionless, camera-first "Add Update".
 *
 * New flow (3 taps max):
 *   Tap "Add Update" → Camera opens immediately
 *   → Photo preview + activity buttons (single screen)
 *   → Tap submit → Done (auto-return)
 *
 * No typing. No multi-step. No confusion.
 * Offline-safe: queues to IndexedDB if network fails.
 * Duplicate-safe: submitGuardRef + timestamp dedup.
 */

// ─── Activity options (max 5, short labels) ───────────────
// Auto-suggest order: most likely first based on season stage

const IMAGE_STAGE_MAP = {
  planting: 'early_growth',
  growing: 'mid_stage',
  flowering: 'pre_harvest',
  harvest: 'harvest',
};

function getActivityOptions(t, suggestedActivity) {
  const opts = [
    { value: 'progress', label: t('update.activity.progress'), icon: '🌱' },
    { value: 'harvest', label: t('update.activity.harvest'), icon: '🌾' },
    { value: 'spray', label: t('update.activity.spray'), icon: '💧' },
    { value: 'pesticide', label: t('update.activity.pesticide'), icon: '🧴' },
    { value: 'issue', label: t('update.activity.issue'), icon: '⚠️' },
    { value: 'other', label: t('update.activity.other'), icon: '📋' },
  ];
  // Move suggested to front
  if (suggestedActivity) {
    const idx = opts.findIndex(o => o.value === suggestedActivity);
    if (idx > 0) {
      const [item] = opts.splice(idx, 1);
      opts.unshift(item);
    }
  }
  return opts;
}

// Map activity value → API activityType
const ACTIVITY_API_MAP = {
  progress: 'other',
  harvest: 'harvesting',
  spray: 'spraying',
  pesticide: 'pesticide',
  issue: 'other',
  other: 'other',
};

// Map activity → condition (issue = poor, others = good)
const ACTIVITY_CONDITION_MAP = {
  progress: 'good',
  harvest: 'good',
  spray: 'average',
  pesticide: 'average',
  issue: 'poor',
  other: 'good',
};

// Map activity → description for API
function activityDescription(val, t) {
  const map = {
    progress: 'Crop progress update',
    harvest: 'Harvest update',
    spray: 'Spraying / treatment update',
    pesticide: 'Pesticide applied',
    issue: 'Issue reported via quick update',
    other: 'Farm update',
  };
  return map[val] || 'Farm update';
}

// Guess best activity from season stage
function suggestActivity(seasonStage) {
  if (!seasonStage) return 'progress';
  const s = seasonStage.toLowerCase();
  if (s.includes('harvest') || s.includes('post')) return 'harvest';
  if (s.includes('flower') || s.includes('fruit')) return 'progress';
  if (s.includes('plant') || s.includes('vegetat') || s.includes('grow')) return 'progress';
  return 'progress';
}

// ─── Photo compression ────────────────────────────────────

const MAX_PHOTO_DIMENSION = 1024;
const PHOTO_QUALITY = 0.7;
const UPLOAD_TIMEOUT_MS = 5000;

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

// ─── Auto-return timer ────────────────────────────────────
const AUTO_RETURN_MS = 2000;

// ─── Main component ────────────────────────────────────────

export default function QuickUpdateFlow({ seasonId, farmerId, onComplete, onCancel, entries, seasonStage }) {
  // Steps: camera | review | submitting | done | offline | error
  const [step, setStep] = useState('camera');
  const [activity, setActivity] = useState(() => suggestActivity(seasonStage));
  const [pesticideName, setPesticideName] = useState('');
  const [pesticideAmount, setPesticideAmount] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const startTime = useRef(Date.now());
  const autoReturnTimer = useRef(null);
  const { t } = useTranslation();

  const suggested = suggestActivity(seasonStage);
  const ACTIVITY_OPTIONS = getActivityOptions(t, suggested);

  // ─── Open camera immediately on mount ───────────────────
  useEffect(() => {
    // Small delay to ensure DOM is ready on mobile
    const timer = setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // ─── Guaranteed action for submit ─────────────────────────
  const submitAction = useGuaranteedAction({
    timeoutMs: 12000,
    onOffline: async () => {
      const offlineData = {
        activityType: ACTIVITY_API_MAP[activity] || 'other',
        entryType: 'activity',
        entryDate: new Date().toISOString().split('T')[0],
        description: activityDescription(activity, t),
      };
      if (activity === 'pesticide') {
        offlineData.metadata = {
          pesticideName: pesticideName.trim(),
          ...(pesticideAmount.trim() ? { amountUsed: pesticideAmount.trim() } : {}),
        };
      }
      const offlinePayload = {
        method: 'POST',
        url: `/seasons/${seasonId}/progress`,
        data: offlineData,
        entityType: 'progress',
        actionType: 'create',
        idempotencyKey: getIdempotencyKey('progress', `${farmerId}:${seasonId}:${activity}:${Date.now()}`),
      };
      await enqueue(offlinePayload);
      trackPilotEvent('quick_update_offline', { farmerId, activity });
    },
  });

  // Cleanup
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      if (autoReturnTimer.current) clearTimeout(autoReturnTimer.current);
    };
  }, [photoPreview]);

  // ─── Auto-return on success/offline ─────────────────────
  const scheduleAutoReturn = useCallback(() => {
    autoReturnTimer.current = setTimeout(() => {
      onComplete?.();
    }, AUTO_RETURN_MS);
  }, [onComplete]);

  // ─── Photo capture ──────────────────────────────────────

  const handlePhotoCapture = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User cancelled camera — stay on review with no photo
      setStep('review');
      return;
    }
    try {
      const compressed = await compressPhoto(file);
      setPhotoFile(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
    } catch {
      // If compression fails, use original
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
    setStep('review');
  }, []);

  const retakePhoto = useCallback(() => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    fileInputRef.current?.click();
  }, [photoPreview]);

  // ─── Background image upload (decoupled from submit) ─────
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadDone, setPhotoUploadDone] = useState(false);
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false);
  const photoUploadRef = useRef(null); // holds the pending upload promise

  const uploadPhotoBackground = useCallback((blob, sid, act, fid) => {
    setPhotoUploading(true);
    setPhotoUploadDone(false);
    setPhotoUploadFailed(false);

    const doUpload = async () => {
      const formData = new FormData();
      formData.append('photo', blob, 'quick-update.jpg');
      try {
        const uploadRes = await api.post('/farmers/me/profile-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (sid) {
          const imageUrl = uploadRes.data?.imageUrl || uploadRes.data?.profileImageUrl;
          if (imageUrl) {
            await api.post(`/seasons/${sid}/progress-image`, {
              imageUrl,
              imageStage: IMAGE_STAGE_MAP[act] || 'mid_stage',
              description: `${act} update photo`,
            }).catch(() => {});
          }
        }
        trackPilotEvent('photo_uploaded', { farmerId: fid, context: 'quick_update' });
        setPhotoUploadDone(true);
      } catch (photoErr) {
        trackPilotEvent('photo_failed', { farmerId: fid, context: 'quick_update', error: photoErr?.message });
        setPhotoUploadFailed(true);
      } finally {
        setPhotoUploading(false);
      }
    };

    photoUploadRef.current = doUpload();
  }, []);

  const retryPhotoUpload = useCallback(() => {
    if (photoFile && seasonId) {
      uploadPhotoBackground(photoFile, seasonId, activity, farmerId);
    }
  }, [photoFile, seasonId, activity, farmerId, uploadPhotoBackground]);

  // ─── Submit (FAST — text only, then show success) ───────

  const handleSubmit = useCallback(async () => {
    setStep('submitting');
    setError('');

    await submitAction.run(async () => {
      const elapsed = Math.round((Date.now() - startTime.current) / 1000);
      const isFirstUpdate = entries && entries.length === 0;

      // 1. Submit activity/progress entry (FAST — text only)
      const payload = {
        activityType: ACTIVITY_API_MAP[activity] || 'other',
        entryType: 'activity',
        entryDate: new Date().toISOString().split('T')[0],
        description: activityDescription(activity, t),
      };

      // Attach pesticide metadata when applicable
      if (activity === 'pesticide') {
        payload.metadata = {
          pesticideName: pesticideName.trim(),
          ...(pesticideAmount.trim() ? { amountUsed: pesticideAmount.trim() } : {}),
        };
      }

      await api.post(`/seasons/${seasonId}/progress`, payload);

      // 2. Auto-set condition (non-blocking)
      const condition = ACTIVITY_CONDITION_MAP[activity] || 'good';
      api.post(`/seasons/${seasonId}/condition`, {
        cropCondition: condition,
        conditionNotes: activity === 'issue' ? 'Reported via quick update' : '',
      }).catch(() => {});

      // 3. Kick off photo upload in background — DO NOT AWAIT
      if (photoFile) {
        uploadPhotoBackground(photoFile, seasonId, activity, farmerId);
      }

      if (isFirstUpdate) {
        trackPilotEvent('first_update_submitted', { farmerId, seasonId, via: 'quick_update' });
      }
      trackPilotEvent('quick_update_completed', { farmerId, elapsed, activity, hasPhoto: !!photoFile });
    });

    // Map result to step — happens IMMEDIATELY after text save
    if (submitAction.isSuccess) {
      setStep('done');
      scheduleAutoReturn();
    } else if (submitAction.isSavedOffline) {
      setStep('offline');
      scheduleAutoReturn();
    } else if (submitAction.isRetryable || submitAction.isError) {
      setError(submitAction.error);
      setStep('error');
    }
  }, [activity, photoFile, seasonId, farmerId, entries, submitAction, t, scheduleAutoReturn, uploadPhotoBackground]);

  // ─── Render: Camera (initial) ───────────────────────────

  if (step === 'camera') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoCapture}
          style={{ display: 'none' }}
          data-testid="photo-input"
        />
        {/* Fallback UI while camera is opening */}
        <div style={QS.cameraWaiting}>
          <div style={QS.spinner} />
          <p style={QS.waitingText}>{t('update.openingCamera')}</p>
          <button
            onClick={() => setStep('review')}
            style={QS.skipCameraBtn}
          >
            {t('update.skipPhoto')} &rarr;
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Review (photo + activity select + submit) ──

  if (step === 'review') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoCapture}
          style={{ display: 'none' }}
          data-testid="photo-input"
        />

        {/* Header */}
        <div style={QS.header}>
          <button onClick={onCancel} style={QS.closeBtn} aria-label="Close">&times;</button>
          <span style={QS.title}>{t('update.addUpdate')}</span>
          <div style={{ width: 44 }} />
        </div>

        {/* Photo preview or retake */}
        <div style={QS.photoSection}>
          {photoPreview ? (
            <div style={QS.previewWrap}>
              <img src={photoPreview} alt="Preview" style={QS.previewImg} />
              <button onClick={retakePhoto} style={QS.retakeBtn}>
                {t('update.retake')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={QS.addPhotoBtn}
              data-testid="capture-photo-btn"
            >
              <span style={{ fontSize: '1.5rem' }}>📷</span>
              <span>{t('update.addPhotoOptional')}</span>
            </button>
          )}
        </div>

        {/* Activity selection — tap buttons, not dropdown */}
        <div style={QS.sectionLabel}>{t('update.whatHappened')}</div>
        <div style={QS.activityGrid} data-testid="activity-select">
          {ACTIVITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setActivity(opt.value)}
              style={{
                ...QS.activityBtn,
                ...(activity === opt.value ? QS.activityBtnActive : {}),
              }}
              data-testid={`activity-${opt.value}`}
            >
              <span style={QS.activityIcon}>{opt.icon}</span>
              <span style={QS.activityLabel}>{opt.label}</span>
              {opt.value === suggested && activity === opt.value && (
                <span style={QS.suggestedTag}>{t('update.suggested')}</span>
              )}
            </button>
          ))}
        </div>

        {/* Pesticide fields — shown only when pesticide selected */}
        {activity === 'pesticide' && (
          <div style={QS.pesticideFields} data-testid="pesticide-fields">
            <div style={QS.fieldWrap}>
              <label style={QS.fieldLabel}>{t('update.pesticideName')} *</label>
              <input
                type="text"
                value={pesticideName}
                onChange={e => setPesticideName(e.target.value)}
                placeholder={t('update.pesticideNameHint')}
                style={QS.fieldInput}
                data-testid="pesticide-name-input"
                autoComplete="off"
              />
            </div>
            <div style={QS.fieldWrap}>
              <label style={QS.fieldLabel}>{t('update.pesticideAmount')}</label>
              <input
                type="text"
                value={pesticideAmount}
                onChange={e => setPesticideAmount(e.target.value)}
                placeholder={t('update.pesticideAmountHint')}
                style={QS.fieldInput}
                data-testid="pesticide-amount-input"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          style={{
            ...QS.submitBtn,
            ...(activity === 'pesticide' && !pesticideName.trim() ? QS.submitBtnDisabled : {}),
          }}
          disabled={activity === 'pesticide' && !pesticideName.trim()}
          data-testid="submit-update-btn"
        >
          {t('update.submitUpdate')}
        </button>
      </div>
    );
  }

  // ─── Render: Submitting (brief — text save only) ────────

  if (step === 'submitting') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <ActionFeedback
          state={ACTION_STATE.LOADING}
          stillWorking={submitAction.stillWorking}
          loadingText={t('update.saving')}
          compact
        />
      </div>
    );
  }

  // ─── Render: Success (with background upload indicator) ─

  if (step === 'done') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <div style={QS.successScreen}>
          <div style={QS.successIcon}>&#x2705;</div>
          <div style={QS.successTitle}>{t('update.saved')}</div>

          {/* Background photo upload status */}
          {photoUploading && (
            <div style={QS.uploadIndicator} data-testid="photo-uploading">
              <div style={QS.uploadSpinner} />
              <span style={QS.uploadText}>{t('update.uploadingPhoto')}</span>
            </div>
          )}
          {photoUploadDone && (
            <div style={QS.uploadDoneIndicator} data-testid="photo-upload-done">
              <span>&#x2705;</span>
              <span style={QS.uploadText}>{t('update.photoUploaded')}</span>
            </div>
          )}
          {photoUploadFailed && (
            <div style={QS.uploadFailIndicator} data-testid="photo-upload-failed">
              <span style={QS.uploadFailText}>{t('update.photoFailed')}</span>
              <button onClick={retryPhotoUpload} style={QS.retryUploadBtn} data-testid="retry-photo-btn">
                {t('common.retry')}
              </button>
            </div>
          )}

          <button onClick={() => onComplete?.()} style={QS.doneBtn}>
            {t('common.done')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Offline ────────────────────────────────────

  if (step === 'offline') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <div style={QS.offlineScreen}>
          <div style={QS.offlineIcon}>📡</div>
          <div style={QS.offlineTitle}>{t('update.savedOfflineMsg')}</div>
          <div style={QS.offlineSub}>{t('update.willSyncReconnect')}</div>
          <button onClick={() => onComplete?.()} style={QS.doneBtn}>
            {t('common.done')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Error + Retry ──────────────────────────────

  if (step === 'error') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <VoiceBar voiceKey="update.failed" compact />
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
    background: '#0F172A', borderRadius: '16px', padding: '1rem',
  },

  // Camera waiting screen
  cameraWaiting: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '1rem', minHeight: '300px',
  },
  waitingText: {
    fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: 0,
  },
  skipCameraBtn: {
    marginTop: '1rem', padding: '0.75rem 1.5rem', background: 'transparent',
    color: '#A1A1AA', border: '1px solid #243041', borderRadius: '12px',
    fontSize: '0.9rem', cursor: 'pointer', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  spinner: {
    width: '32px', height: '32px', border: '3px solid #243041',
    borderTopColor: '#22C55E', borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },

  // Header
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  closeBtn: {
    width: '44px', height: '44px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'transparent', border: '1px solid #243041',
    borderRadius: '10px', color: '#FFFFFF', fontSize: '1.25rem', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent', minHeight: '44px',
  },
  title: { fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' },

  // Photo section
  photoSection: {
    marginBottom: '1rem',
  },
  previewWrap: {
    position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden',
  },
  previewImg: {
    width: '100%', height: 'auto', display: 'block', borderRadius: '12px',
    maxHeight: '220px', objectFit: 'cover',
  },
  retakeBtn: {
    position: 'absolute', bottom: '8px', right: '8px',
    padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.7)', color: '#FFFFFF',
    border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600,
    cursor: 'pointer', minHeight: '36px',
    WebkitTapHighlightColor: 'transparent',
  },
  addPhotoBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    width: '100%', padding: '1rem', background: '#162033',
    border: '2px dashed #243041', borderRadius: '12px',
    color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.9rem',
    minHeight: '52px', WebkitTapHighlightColor: 'transparent',
  },

  // Activity section
  sectionLabel: {
    fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
    marginBottom: '0.5rem',
  },
  activityGrid: {
    display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
  },
  activityBtn: {
    display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative',
    padding: '0.65rem 1rem', background: '#162033', border: '2px solid #243041',
    borderRadius: '12px', cursor: 'pointer', color: '#FFFFFF',
    fontSize: '0.9rem', fontWeight: 600, minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  activityBtnActive: {
    border: '2px solid #22C55E', background: 'rgba(34,197,94,0.12)',
  },
  activityIcon: { fontSize: '1.1rem' },
  activityLabel: { fontSize: '0.9rem' },
  suggestedTag: {
    fontSize: '0.65rem', fontWeight: 700, color: '#22C55E',
    background: 'rgba(34,197,94,0.15)', padding: '0.1rem 0.35rem',
    borderRadius: '4px', marginLeft: '0.15rem',
  },

  // Pesticide fields
  pesticideFields: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem',
    padding: '0.75rem', background: '#162033', borderRadius: '12px',
    border: '1px solid #243041',
  },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  fieldLabel: {
    fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
  },
  fieldInput: {
    padding: '0.7rem 0.75rem', background: '#0F172A', border: '1px solid #334155',
    borderRadius: '10px', color: '#FFFFFF', fontSize: '1rem',
    minHeight: '44px', outline: 'none', WebkitAppearance: 'none',
  },

  // Submit
  submitBtn: {
    width: '100%', padding: '1rem', marginTop: 'auto',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    color: '#FFFFFF', border: 'none', borderRadius: '14px',
    fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer',
    minHeight: '56px', WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
  },
  submitBtnDisabled: {
    opacity: 0.4, cursor: 'not-allowed',
    background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    boxShadow: 'none',
  },

  // Success screen
  successScreen: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.75rem', minHeight: '300px',
    textAlign: 'center',
  },
  successIcon: { fontSize: '3.5rem' },
  successTitle: {
    fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF',
  },

  // Offline screen
  offlineScreen: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.5rem', minHeight: '300px',
    textAlign: 'center',
  },
  offlineIcon: { fontSize: '2.5rem' },
  offlineTitle: {
    fontSize: '1.1rem', fontWeight: 700, color: '#FDE68A',
  },
  offlineSub: {
    fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', maxWidth: '280px',
  },

  // Done button (success/offline)
  doneBtn: {
    marginTop: '0.5rem', padding: '0.85rem 2.5rem',
    background: '#22C55E', color: '#FFFFFF', border: 'none',
    borderRadius: '12px', fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer', minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
  },

  // Background upload indicators
  uploadIndicator: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.75rem', borderRadius: '8px',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
  },
  uploadSpinner: {
    width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.15)',
    borderTopColor: '#22C55E', borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite', flexShrink: 0,
  },
  uploadText: {
    fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)',
  },
  uploadDoneIndicator: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    fontSize: '0.85rem', color: '#86EFAC',
  },
  uploadFailIndicator: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.75rem', borderRadius: '8px',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
  },
  uploadFailText: {
    fontSize: '0.8rem', color: '#FCA5A5', flex: 1,
  },
  retryUploadBtn: {
    padding: '0.35rem 0.75rem', background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
    color: '#FCA5A5', fontSize: '0.75rem', fontWeight: 700,
    cursor: 'pointer', minHeight: '32px',
    WebkitTapHighlightColor: 'transparent',
  },
};
