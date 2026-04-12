import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useTreatmentSubmit } from '../hooks/useIntelligence.js';
import { COLORS } from '../constants/intelligence.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import VoiceBar from '../components/VoiceBar.jsx';

const STEP_VOICE_KEYS = { 1: 'treatment.chooseType', 2: 'treatment.outcome' };

const TREATMENT_TYPES = [
  { key: 'chemical_spray', icon: 'Chemical Spray' },
  { key: 'biological_control', icon: 'Biological' },
  { key: 'manual_removal', icon: 'Manual Removal' },
  { key: 'organic_treatment', icon: 'Organic' },
  { key: 'other', icon: 'Other' },
];
const OUTCOME_OPTIONS = [
  { key: 'resolved', icon: '\u2705' },
  { key: 'improved', icon: '\u2B06' },
  { key: 'same', icon: '\u27A1' },
  { key: 'worse', icon: '\u2B07' },
];

const DRAFT_KEY = 'agripilot_treatment_draft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export default function TreatmentFeedback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const reportId = location.state?.reportId || searchParams.get('reportId');

  const { submitTreatment, submitOutcome, loading, error: hookError } = useTreatmentSubmit();

  const draft = useRef(loadDraft());
  const submitGuardRef = useRef(false);
  const [step, setStep] = useState(1);
  const [treatmentType, setTreatmentType] = useState(draft.current?.treatmentType || '');
  const [productUsed, setProductUsed] = useState(draft.current?.productUsed || '');
  const [treatmentNotes, setTreatmentNotes] = useState(draft.current?.treatmentNotes || '');
  const [treatmentDate, setTreatmentDate] = useState(
    draft.current?.treatmentDate || new Date().toISOString().slice(0, 10)
  );
  const [treatmentId, setTreatmentId] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [followupPhoto, setFollowupPhoto] = useState(null);
  const [followupPreview, setFollowupPreview] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showCheckmark, setShowCheckmark] = useState(false);

  const error = localError || (hookError ? (typeof hookError === 'string' ? hookError : hookError.message || t('treatment.saveFailed')) : '');

  // Save draft on input change (step 1 only)
  useEffect(() => {
    if (step === 1 && !submitted) {
      saveDraft({ treatmentType, productUsed, treatmentNotes, treatmentDate });
    }
  }, [treatmentType, productUsed, treatmentNotes, treatmentDate, step, submitted]);

  const handleFollowupPhoto = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const preview = await readFileAsDataURL(file);
      setFollowupPhoto(file);
      setFollowupPreview(preview);
    } catch {
      // ignore
    }
  }, []);

  const handleLogTreatment = async () => {
    if (!reportId || !treatmentType || submitGuardRef.current) return;
    submitGuardRef.current = true;
    setLocalError('');
    try {
      const result = await submitTreatment(reportId, {
        actionTaken: treatmentType,
        productUsed: productUsed.trim() || null,
        notes: treatmentNotes.trim() || null,
        actionDate: new Date(treatmentDate).toISOString(),
      });
      const id = result?.treatmentId || result?.id;
      setTreatmentId(id);
      trackPilotEvent('update_submitted', { type: 'treatment', reportId });
      setStep(2);
    } catch (err) {
      setLocalError(err.message || t('treatment.saveFailed'));
      trackPilotEvent('update_failed', { type: 'treatment', error: err.message });
    } finally {
      submitGuardRef.current = false;
    }
  };

  const handleLogOutcome = async () => {
    if (!treatmentId || !outcome) return;
    setLocalError('');
    try {
      await submitOutcome(treatmentId, {
        outcomeStatus: outcome,
        followupNotes: outcomeNotes.trim() || null,
        followupDate: new Date().toISOString(),
        followupImageUrl: followupPreview || null,
      });
      clearDraft();
      setShowCheckmark(true);
      setTimeout(() => {
        setShowCheckmark(false);
        setSubmitted(true);
      }, 1500);
    } catch (err) {
      setLocalError(err.message || t('treatment.saveFailed'));
    }
  };

  const handleRetry = () => {
    setLocalError('');
    if (step === 1) handleLogTreatment();
    else handleLogOutcome();
  };

  if (!reportId) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.errorBox}>{t('treatment.noReport')}</div>
          <button style={S.backBtn} onClick={() => navigate(-1)}>
            {t('pest.back')}
          </button>
        </div>
      </div>
    );
  }

  // Animated checkmark transition
  if (showCheckmark) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.checkmarkCenter}>
            <div style={S.checkmarkCircle}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" stroke={COLORS.green} strokeWidth="3" fill={COLORS.greenLight} />
                <path d="M20 33L28 41L44 23" stroke={COLORS.green} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ color: COLORS.green, fontSize: '1.1rem', fontWeight: 600, marginTop: '1rem' }}>
              {t('treatment.recorded')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.successCard}>
            <div style={S.successIconWrap}>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="26" stroke={COLORS.green} strokeWidth="3" fill={COLORS.greenLight} />
                <path d="M17 29L25 37L39 21" stroke={COLORS.green} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 style={S.successTitle}>{t('treatment.recorded')}</h2>
            <p style={S.successText}>{t('treatment.recordedDesc')}</p>
            <div style={S.successBtnRow}>
              <button
                style={S.ctaBtn}
                onClick={() => navigate('/pest-risk-result', { state: { reportId } })}
              >
                {t('treatment.viewReport')}
              </button>
              <button
                style={S.ctaSecondary}
                onClick={() => navigate('/dashboard')}
              >
                {t('treatment.backToDashboard')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Back */}
        <button style={S.backLink} onClick={() => navigate(-1)}>
          {'\u2190'} {t('pest.back')}
        </button>

        {/* Voice guide */}
        <VoiceBar voiceKey={submitted ? 'treatment.saved' : STEP_VOICE_KEYS[step]} compact />

        {/* Header */}
        <h1 style={S.title}>
          {step === 1 ? t('treatment.logTitle') : t('treatment.outcomeTitle')}
        </h1>
        <p style={S.subtitle}>
          {step === 1 ? t('treatment.logSubtitle') : t('treatment.outcomeSubtitle')}
        </p>

        {/* Step indicator */}
        <div style={S.stepIndicator}>
          <div style={{
            ...S.stepDot,
            background: COLORS.green,
            color: COLORS.text,
          }}>
            {step > 1 ? '\u2713' : '1'}
          </div>
          <div style={{
            ...S.stepLine,
            background: step > 1 ? COLORS.green : 'rgba(255,255,255,0.1)',
          }} />
          <div style={{
            ...S.stepDot,
            background: step >= 2 ? COLORS.green : 'rgba(255,255,255,0.15)',
            color: step >= 2 ? COLORS.text : COLORS.muted,
          }}>
            2
          </div>
        </div>

        {/* Error with retry */}
        {error && (
          <div style={S.errorBox}>
            <span>{error}</span>
            {!loading && (
              <button style={S.retryInlineBtn} onClick={handleRetry}>
                {t('pest.retry')}
              </button>
            )}
          </div>
        )}

        {/* Step 1: Treatment details */}
        {step === 1 && (
          <div style={S.card}>
            <label style={S.label}>{t('treatment.type')}</label>
            <div style={S.typeGrid}>
              {TREATMENT_TYPES.map(tt => (
                <button
                  key={tt.key}
                  type="button"
                  style={{
                    ...S.typeBtn,
                    background: treatmentType === tt.key ? COLORS.green : 'rgba(255,255,255,0.06)',
                    color: treatmentType === tt.key ? COLORS.text : COLORS.subtext,
                    borderColor: treatmentType === tt.key ? COLORS.green : 'rgba(255,255,255,0.12)',
                  }}
                  onClick={() => setTreatmentType(tt.key)}
                >
                  <span style={S.typeBtnLabel}>{t(`treatment.type.${tt.key}`)}</span>
                </button>
              ))}
            </div>

            <label style={S.label}>{t('treatment.product')}</label>
            <input
              type="text"
              style={S.input}
              placeholder={t('treatment.productPlaceholder')}
              value={productUsed}
              onChange={e => setProductUsed(e.target.value)}
            />

            <label style={S.label}>{t('treatment.date')}</label>
            <input
              type="date"
              style={S.input}
              value={treatmentDate}
              onChange={e => setTreatmentDate(e.target.value)}
            />

            <label style={S.label}>{t('treatment.notes')}</label>
            <textarea
              style={S.textarea}
              placeholder={t('treatment.notesPlaceholder')}
              value={treatmentNotes}
              onChange={e => setTreatmentNotes(e.target.value)}
              rows={3}
            />

            <button
              style={{
                ...S.ctaBtn,
                opacity: treatmentType && !loading ? 1 : 0.5,
              }}
              onClick={handleLogTreatment}
              disabled={!treatmentType || loading}
            >
              {loading ? t('treatment.saving') : t('treatment.save')}
            </button>
          </div>
        )}

        {/* Step 2: Outcome */}
        {step === 2 && (
          <div style={S.card}>
            <label style={S.label}>{t('treatment.howDidItGo')}</label>
            <div style={S.outcomeGrid}>
              {OUTCOME_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  style={{
                    ...S.outcomeBtn,
                    background: outcome === opt.key ? COLORS.green : 'rgba(255,255,255,0.06)',
                    color: outcome === opt.key ? COLORS.text : COLORS.subtext,
                    borderColor: outcome === opt.key ? COLORS.green : 'rgba(255,255,255,0.12)',
                  }}
                  onClick={() => setOutcome(opt.key)}
                >
                  <span style={S.outcomeIcon}>{opt.icon}</span>
                  <span>{t(`treatment.outcome.${opt.key}`)}</span>
                </button>
              ))}
            </div>

            <label style={S.label}>{t('treatment.notes')}</label>
            <textarea
              style={S.textarea}
              placeholder={t('treatment.outcomeNotesPlaceholder')}
              value={outcomeNotes}
              onChange={e => setOutcomeNotes(e.target.value)}
              rows={3}
            />

            {/* Optional follow-up photo */}
            <label style={S.label}>{t('treatment.followupPhoto')}</label>
            {followupPreview ? (
              <div style={S.photoPreviewWrap}>
                <img src={followupPreview} alt="Follow-up" style={S.photoPreview} />
                <button
                  type="button"
                  style={S.removePhotoBtn}
                  onClick={() => { setFollowupPhoto(null); setFollowupPreview(null); }}
                >
                  X
                </button>
              </div>
            ) : (
              <label style={S.photoCapture}>
                <span style={S.photoCaptureText}>
                  {t('treatment.addPhoto')}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={S.hiddenInput}
                  onChange={handleFollowupPhoto}
                />
              </label>
            )}

            <button
              style={{
                ...S.ctaBtn,
                opacity: outcome && !loading ? 1 : 0.5,
              }}
              onClick={handleLogOutcome}
              disabled={!outcome || loading}
            >
              {loading ? t('treatment.saving') : t('treatment.submitOutcome')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.text,
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
    paddingBottom: '80px',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: COLORS.subtext,
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: '8px 0',
    marginBottom: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    minHeight: '44px',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: COLORS.subtext,
    margin: '0 0 1rem',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1.25rem',
    maxWidth: '140px',
  },
  stepDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  stepLine: {
    flex: 1,
    height: '3px',
    borderRadius: '2px',
    margin: '0 6px',
  },
  card: {
    borderRadius: '16px',
    background: COLORS.card,
    border: '1px solid ' + COLORS.cardBorder,
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: COLORS.subtext,
    marginBottom: '0.5rem',
    marginTop: '1rem',
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  typeBtn: {
    padding: '14px 8px',
    border: '1.5px solid',
    borderRadius: '10px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '52px',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  typeBtnLabel: {
    lineHeight: 1.3,
  },
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: COLORS.bg,
    color: COLORS.text,
    boxSizing: 'border-box',
    minHeight: '44px',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: COLORS.bg,
    color: COLORS.text,
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  outcomeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  outcomeBtn: {
    padding: '14px 8px',
    border: '1.5px solid',
    borderRadius: '10px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '52px',
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
  outcomeIcon: {
    fontSize: '1.2rem',
  },
  photoCapture: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    border: '1.5px dashed rgba(255,255,255,0.15)',
    cursor: 'pointer',
    minHeight: '52px',
  },
  photoCaptureText: {
    fontSize: '0.85rem',
    color: COLORS.subtext,
    fontWeight: 500,
  },
  hiddenInput: {
    display: 'none',
  },
  photoPreviewWrap: {
    position: 'relative',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '120px',
    objectFit: 'cover',
    display: 'block',
    borderRadius: '10px',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.7)',
    color: COLORS.text,
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: COLORS.green,
    color: COLORS.text,
    fontSize: '1.05rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
    marginTop: '1.25rem',
  },
  ctaSecondary: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: COLORS.subtext,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  },
  backBtn: {
    padding: '12px 24px',
    borderRadius: '10px',
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: COLORS.subtext,
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
  },
  checkmarkCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  checkmarkCircle: {
    animation: 'fadeIn 0.5s ease',
  },
  successCard: {
    borderRadius: '16px',
    background: COLORS.card,
    border: '1px solid rgba(34,197,94,0.2)',
    padding: '2.5rem 1.5rem',
    textAlign: 'center',
    marginTop: '2rem',
  },
  successIconWrap: {
    marginBottom: '1rem',
  },
  successTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: '0 0 0.5rem',
  },
  successText: {
    fontSize: '0.9rem',
    color: COLORS.subtext,
    margin: '0 0 1.5rem',
  },
  successBtnRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    background: 'rgba(252,165,165,0.1)',
    border: '1px solid #FCA5A5',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
  retryInlineBtn: {
    background: 'rgba(252,165,165,0.15)',
    border: '1px solid #FCA5A5',
    borderRadius: '6px',
    color: '#FCA5A5',
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '6px 14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minHeight: '32px',
  },
};
