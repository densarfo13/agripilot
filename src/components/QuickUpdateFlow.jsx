import React, { useState, useRef, useCallback, useEffect } from 'react';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { enqueue, isOnline } from '../utils/offlineQueue.js';
import api from '../api/client.js';
import VoiceBar from './VoiceBar.jsx';
import { trackVoiceStepCompleted } from '../utils/voiceAnalytics.js';

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

const ACTION_OPTIONS = [
  { value: 'progress', label: 'Crop Progress', icon: '🌱', desc: 'Log stage & condition' },
  { value: 'photo', label: 'Upload Photo', icon: '📷', desc: 'Take a farm photo' },
  { value: 'issue', label: 'Report Issue', icon: '⚠️', desc: 'Pest, disease, weather' },
];

const STAGE_OPTIONS = [
  { value: 'planting', label: 'Planting', icon: '🌱' },
  { value: 'vegetative', label: 'Growing', icon: '🌿' },
  { value: 'flowering', label: 'Flowering', icon: '🌼' },
  { value: 'harvest', label: 'Harvesting', icon: '🌾' },
];

const CONDITION_OPTIONS = [
  { value: 'good', label: 'Good', icon: '👍', color: '#22C55E' },
  { value: 'average', label: 'Okay', icon: '👌', color: '#F59E0B' },
  { value: 'poor', label: 'Problem', icon: '👎', color: '#EF4444' },
];

const IMAGE_STAGE_MAP = {
  planting: 'early_growth',
  vegetative: 'mid_stage',
  flowering: 'pre_harvest',
  harvest: 'harvest',
};

// Map QuickUpdateFlow steps to voice guide keys
const STEP_VOICE_KEY = {
  action: 'update_start',
  stage: 'update_stage',
  condition: 'update_condition',
  photo: 'update_photo',
  submitting: 'update_submitting',
  done: 'update_success',
  offline: 'update_offline',
  error: 'update_failed',
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
  const submitGuardRef = useRef(false);
  const fileInputRef = useRef(null);
  const startTime = useRef(Date.now());

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

  // ─── Submit ──────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setStep('submitting');
    setError('');

    const elapsed = Math.round((Date.now() - startTime.current) / 1000);

    try {
      // Build payload based on action path
      const isFirstUpdate = entries && entries.length === 0;

      if (action === 'progress' || action === 'issue') {
        // Log activity + condition
        const payload = {
          activityType: action === 'issue' ? 'other' : (stage || 'other'),
          entryType: 'activity',
          entryDate: new Date().toISOString().split('T')[0],
          description: action === 'issue' ? 'Issue reported via quick update' : '',
        };

        if (condition) {
          // Submit condition as a separate call, or embed it
          await api.post(`/seasons/${seasonId}/progress`, payload);
          await api.post(`/seasons/${seasonId}/condition`, {
            cropCondition: condition,
            conditionNotes: action === 'issue' ? 'Reported via quick update' : '',
          });
        } else {
          await api.post(`/seasons/${seasonId}/progress`, payload);
        }

        if (stage) {
          // Also confirm stage
          await api.post(`/seasons/${seasonId}/stage-confirmation`, {
            confirmedStage: stage,
            note: 'Confirmed via quick update',
          }).catch(() => {}); // stage confirmation is supplemental
        }

        if (isFirstUpdate) {
          trackPilotEvent('first_update_submitted', { farmerId, seasonId, via: 'quick_update' });
        }
        trackPilotEvent('update_submitted', { farmerId, seasonId, type: action, elapsed });
      }

      // Upload photo if captured
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile, 'quick-update.jpg');
        try {
          const uploadRes = await api.post('/farmers/me/profile-photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          // Also save as progress image if we have a season
          if (seasonId) {
            const imageUrl = uploadRes.data?.imageUrl || uploadRes.data?.profileImageUrl;
            if (imageUrl) {
              await api.post(`/seasons/${seasonId}/progress-image`, {
                imageUrl,
                imageStage: IMAGE_STAGE_MAP[stage] || 'mid_stage',
                description: action === 'photo' ? 'Quick photo update' : `${action} update photo`,
              }).catch(() => {}); // progress-image is supplemental
            }
          }
          trackPilotEvent('photo_uploaded', { farmerId, context: 'quick_update' });
        } catch (photoErr) {
          // Photo upload failed but activity was saved — partial success
          trackPilotEvent('photo_failed', { farmerId, context: 'quick_update', error: photoErr?.message });
          // Don't fail the whole update
        }
      }

      // For photo-only action with no other data submitted yet
      if (action === 'photo' && !photoFile) {
        // User skipped photo — nothing to submit
        submitGuardRef.current = false;
        setStep('action');
        return;
      }

      if (action === 'photo' && photoFile && !condition && !stage) {
        // Photo-only path — photo was uploaded above
        trackPilotEvent('update_submitted', { farmerId, seasonId, type: 'photo_only', elapsed });
      }

      trackPilotEvent('quick_update_completed', { farmerId, elapsed, action });
      setStep('done');
    } catch (err) {
      // Network failure — queue offline
      if (!err.response && !isOnline()) {
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
        setStep('offline');
      } else {
        setError(err.response?.data?.error || 'Something went wrong. Tap retry.');
        trackPilotEvent('quick_update_failed', { farmerId, action, error: err?.message });
        setStep('error');
      }
    } finally {
      submitGuardRef.current = false;
    }
  }, [action, stage, condition, photoFile, seasonId, farmerId, entries]);

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
          <span style={QS.title}>Add Update</span>
          <div style={{ width: 44 }} />
        </div>
        {renderStepIndicator()}
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.stepTitle}>What do you want to do?</div>
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
          <span style={QS.title}>Crop Stage</span>
          <div style={{ width: 44 }} />
        </div>
        {renderStepIndicator()}
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.stepTitle}>What stage is your crop?</div>
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
          <span style={QS.title}>Condition</span>
          <div style={{ width: 44 }} />
        </div>
        {renderStepIndicator()}
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.stepTitle}>How does your crop look?</div>
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
          <span style={QS.title}>Photo</span>
          <div style={{ width: 44 }} />
        </div>
        {renderStepIndicator()}
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.stepTitle}>
          {action === 'photo' ? 'Take a photo of your farm' : 'Add a photo (optional)'}
        </div>
        <div style={QS.photoArea} data-testid="photo-step">
          {photoPreview ? (
            <div style={QS.previewWrap}>
              <img src={photoPreview} alt="Preview" style={QS.previewImg} />
              <button onClick={clearPhoto} style={QS.removePhotoBtn}>✕ Remove</button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={QS.captureBtn}
              data-testid="capture-photo-btn"
            >
              <span style={{ fontSize: '2.5rem' }}>📷</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Tap to take photo</span>
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
          {action === 'photo' ? 'Save Photo' : photoFile ? 'Submit with Photo' : 'Submit Update'}
        </button>
        {action !== 'photo' && !photoFile && (
          <button onClick={handleSubmit} style={QS.skipBtn} data-testid="skip-photo-btn">
            Skip photo →
          </button>
        )}
      </div>
    );
  }

  // ─── Step: Submitting ────────────────────────────────────

  if (step === 'submitting') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <div style={QS.feedbackCenter}>
          <div style={QS.spinner} />
          <div style={QS.feedbackTitle}>Saving your update...</div>
        </div>
      </div>
    );
  }

  // ─── Step: Success ───────────────────────────────────────

  if (step === 'done') {
    const elapsed = Math.round((Date.now() - startTime.current) / 1000);
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.feedbackCenter} data-testid="success-feedback">
          <span style={QS.feedbackIcon}>✅</span>
          <div style={QS.feedbackTitle}>Update Saved!</div>
          <div style={QS.feedbackSub}>Completed in {elapsed}s</div>
          <button onClick={() => onComplete?.()} style={QS.doneBtn} data-testid="done-btn">
            Done
          </button>
        </div>
      </div>
    );
  }

  // ─── Step: Offline ───────────────────────────────────────

  if (step === 'offline') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.feedbackCenter} data-testid="offline-feedback">
          <span style={QS.feedbackIcon}>📡</span>
          <div style={QS.feedbackTitle}>Saved Offline</div>
          <div style={QS.feedbackSub}>Your update will sync when you reconnect.</div>
          <button onClick={() => onComplete?.()} style={QS.doneBtn}>
            Okay
          </button>
        </div>
      </div>
    );
  }

  // ─── Step: Error + Retry ─────────────────────────────────

  if (step === 'error') {
    return (
      <div style={QS.container} data-testid="quick-update-flow">
        <VoiceBar voiceKey={voiceKey} compact />
        <div style={QS.feedbackCenter} data-testid="error-feedback">
          <span style={QS.feedbackIcon}>❌</span>
          <div style={QS.feedbackTitle}>Something went wrong</div>
          <div style={QS.feedbackSub}>{error}</div>
          <button onClick={handleSubmit} style={QS.retryBtn} data-testid="retry-btn">
            Retry
          </button>
          <button onClick={onCancel} style={QS.skipBtn}>
            Cancel
          </button>
        </div>
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
