import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { usePestReportSubmit } from '../hooks/useIntelligence.js';
import { uploadPestImage, createPestReport } from '../lib/intelligenceApi.js';
import { COLORS } from '../constants/intelligence.js';

const CROPS = ['maize', 'wheat', 'rice', 'soybean', 'cotton', 'sorghum', 'cassava', 'beans'];
const STAGES = ['seedling', 'vegetative', 'flowering', 'fruiting', 'harvest'];
const IMAGE_SLOTS = [
  { key: 'leaf_closeup', labelKey: 'pest.photoLeaf', icon: 'Leaf close-up' },
  { key: 'whole_plant', labelKey: 'pest.photoPlant', icon: 'Whole plant' },
  { key: 'field_wide', labelKey: 'pest.photoField', icon: 'Field wide' },
];
const QUESTIONS = [
  { key: 'leaves_eaten', labelKey: 'pest.q.leavesEaten' },
  { key: 'spreading', labelKey: 'pest.q.spreading' },
  { key: 'insects_visible', labelKey: 'pest.q.insectsVisible' },
  { key: 'widespread', labelKey: 'pest.q.widespread' },
  { key: 'recent_rain', labelKey: 'pest.q.recentRain' },
  { key: 'recent_heat', labelKey: 'pest.q.recentHeat' },
];
const ANSWER_OPTIONS = ['yes', 'no', 'unsure'];
const TOTAL_STEPS = 4;
const MAX_IMAGE_WIDTH = 1200;
const SLOW_THRESHOLD_MS = 4000;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_WIDTH) {
          height = Math.round((height * MAX_IMAGE_WIDTH) / width);
          width = MAX_IMAGE_WIDTH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Attach dimensions so backend can use real resolution for quality scoring
              blob._imgWidth = width;
              blob._imgHeight = height;
              resolve(blob);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export default function PestRiskCheck() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isOnline } = useNetwork();
  const profileId = profile?.id || profile?._id;
  const { submit, loading: storeLoading, error: submitError } = usePestReportSubmit();
  const [submitting, setSubmitting] = useState(false);
  const submitLoading = storeLoading || submitting;

  const [step, setStep] = useState(1);
  const [cropType, setCropType] = useState('');
  const [growthStage, setGrowthStage] = useState('');
  const [imageFiles, setImageFiles] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [imageQuality, setImageQuality] = useState({}); // { [slotKey]: { qualityPassed, qualityScore, rejectionReason, retryGuidance, imageId, uploading } }
  const [answers, setAnswers] = useState({});
  const [localError, setLocalError] = useState('');
  const [slowIndicator, setSlowIndicator] = useState(false);
  const slowTimer = useRef(null);

  const error = localError || (submitError ? (typeof submitError === 'string' ? submitError : submitError.message || t('pest.submitError')) : '');

  useEffect(() => {
    if (submitLoading) {
      slowTimer.current = setTimeout(() => setSlowIndicator(true), SLOW_THRESHOLD_MS);
    } else {
      setSlowIndicator(false);
      if (slowTimer.current) clearTimeout(slowTimer.current);
    }
    return () => { if (slowTimer.current) clearTimeout(slowTimer.current); };
  }, [submitLoading]);

  const handleImageCapture = useCallback(async (slotKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const preview = await readFileAsDataURL(file);
      const compressed = await compressImage(file);
      setImageFiles(prev => ({ ...prev, [slotKey]: compressed }));
      setImagePreviews(prev => ({ ...prev, [slotKey]: preview }));

      // Upload immediately for quality feedback
      setImageQuality(prev => ({ ...prev, [slotKey]: { uploading: true } }));
      try {
        const dataUrl = await readFileAsDataURL(compressed);
        const metadata = {
          width: compressed._imgWidth || undefined,
          height: compressed._imgHeight || undefined,
          fileSize: compressed.size || undefined,
        };
        const res = await uploadPestImage({ profileId, imageType: slotKey, imageUrl: dataUrl, metadata });
        const data = res?.data || res;
        setImageQuality(prev => ({
          ...prev,
          [slotKey]: {
            uploading: false,
            qualityPassed: data.qualityPassed,
            qualityScore: data.qualityScore,
            rejectionReason: data.rejectionReason,
            retryGuidance: data.retryGuidance,
            imageId: data.imageId,
          },
        }));
      } catch {
        // Upload failed — keep preview, clear quality (will re-upload on submit)
        setImageQuality(prev => ({ ...prev, [slotKey]: { uploading: false, uploadFailed: true } }));
      }
    } catch {
      setLocalError(t('pest.imageError') || 'Failed to process image');
    }
  }, [t, profileId]);

  const removeImage = useCallback((slotKey) => {
    setImageFiles(prev => { const n = { ...prev }; delete n[slotKey]; return n; });
    setImagePreviews(prev => { const n = { ...prev }; delete n[slotKey]; return n; });
    setImageQuality(prev => { const n = { ...prev }; delete n[slotKey]; return n; });
  }, []);

  const setAnswer = useCallback((key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }, []);

  const allImagesUploading = Object.values(imageQuality).some(q => q?.uploading);
  const anyQualityFailed = Object.values(imageQuality).some(q => q && !q.uploading && !q.qualityPassed && !q.uploadFailed);

  const allThreeImages = IMAGE_SLOTS.every(slot => imageFiles[slot.key]);

  const canNext = () => {
    if (step === 1) return cropType && growthStage;
    if (step === 2) return allThreeImages && !allImagesUploading && !anyQualityFailed;
    if (step === 3) return Object.keys(answers).length >= 4;
    return true;
  };

  const handleSubmit = async () => {
    if (!isOnline) {
      setLocalError(t('pest.offlineError') || 'No internet connection. Please try again when online.');
      return;
    }
    setLocalError('');
    setSubmitting(true);
    try {
      // Collect imageIds from already-uploaded images; re-upload any that failed
      const alreadyUploaded = {};
      const needsUpload = [];
      for (const [slotKey, blob] of Object.entries(imageFiles)) {
        const q = imageQuality[slotKey];
        if (q?.imageId && q?.qualityPassed) {
          alreadyUploaded[slotKey] = q.imageId;
        } else {
          needsUpload.push({ slotKey, blob });
        }
      }

      // Upload remaining images
      for (const { slotKey, blob } of needsUpload) {
        const dataUrl = await readFileAsDataURL(blob);
        const res = await uploadPestImage({ profileId, imageType: slotKey, imageUrl: dataUrl });
        const data = res?.data || res;
        alreadyUploaded[slotKey] = data.imageId || data.id;
      }

      const imageIds = Object.values(alreadyUploaded);
      const reportData = {
        profileId,
        cropType,
        growthStage,
        verificationAnswers: answers,
        imageIds,
        notes: `Crop: ${cropType}, Stage: ${growthStage}`,
      };
      // Submit report directly (images already uploaded)
      const raw = await createPestReport(reportData);
      const report = raw?.data || raw;
      navigate('/pest-risk-result', { state: { report } });
    } catch (err) {
      setLocalError(err.message || t('pest.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setLocalError('');
    handleSubmit();
  };

  const next = () => {
    if (step === TOTAL_STEPS) {
      handleSubmit();
      return;
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };
  const back = () => setStep(s => Math.max(s - 1, 1));

  const imageCount = Object.keys(imageFiles).length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Offline banner */}
        {!isOnline && (
          <div style={S.offlineBanner}>
            {t('pest.offline') || 'No connection - you can fill the form, but submission requires internet.'}
          </div>
        )}

        {/* Header */}
        <h1 style={S.title}>{t('pest.title')}</h1>
        <p style={S.subtitle}>{t('pest.subtitle')}</p>

        {/* Stepper */}
        <div style={S.stepper}>
          {[1, 2, 3, 4].map(n => (
            <div key={n} style={S.stepRow}>
              <div style={{
                ...S.stepDot,
                background: n <= step ? COLORS.green : 'rgba(255,255,255,0.15)',
                color: n <= step ? COLORS.text : COLORS.muted,
              }}>
                {n < step ? '\u2713' : n}
              </div>
              {n < 4 && (
                <div style={{
                  ...S.stepLine,
                  background: n < step ? COLORS.green : 'rgba(255,255,255,0.1)',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Error with retry */}
        {error && (
          <div style={S.errorBox}>
            <span>{error}</span>
            {step === TOTAL_STEPS && !submitLoading && (
              <button style={S.retryInlineBtn} onClick={handleRetry}>
                {t('pest.retry') || 'Retry'}
              </button>
            )}
          </div>
        )}

        {/* Step 1: Crop selection */}
        {step === 1 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t('pest.step1')}</h2>

            <label style={S.label}>{t('pest.cropType')}</label>
            <div style={S.chipGrid}>
              {CROPS.map(c => (
                <button
                  key={c}
                  type="button"
                  style={{
                    ...S.chip,
                    background: cropType === c ? COLORS.green : 'rgba(255,255,255,0.06)',
                    color: cropType === c ? COLORS.text : COLORS.subtext,
                    borderColor: cropType === c ? COLORS.green : 'rgba(255,255,255,0.12)',
                  }}
                  onClick={() => setCropType(c)}
                >
                  {t(`crop.${c}`)}
                </button>
              ))}
            </div>

            <label style={S.label}>{t('pest.growthStage')}</label>
            <div style={S.chipGrid}>
              {STAGES.map(s => (
                <button
                  key={s}
                  type="button"
                  style={{
                    ...S.chip,
                    background: growthStage === s ? COLORS.green : 'rgba(255,255,255,0.06)',
                    color: growthStage === s ? COLORS.text : COLORS.subtext,
                    borderColor: growthStage === s ? COLORS.green : 'rgba(255,255,255,0.12)',
                  }}
                  onClick={() => setGrowthStage(s)}
                >
                  {t(`stage.${s}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Image capture */}
        {step === 2 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t('pest.step2')}</h2>
            <p style={S.hint}>{t('pest.photoHint')}</p>
            {IMAGE_SLOTS.map(slot => {
              const q = imageQuality[slot.key];
              return (
                <div key={slot.key} style={S.uploadSlot}>
                  {imagePreviews[slot.key] ? (
                    <>
                      <div style={S.previewWrap}>
                        <img
                          src={imagePreviews[slot.key]}
                          alt={slot.icon}
                          style={{
                            ...S.previewImg,
                            ...(q && !q.uploading && !q.qualityPassed && !q.uploadFailed ? { opacity: 0.5 } : {}),
                          }}
                        />
                        <button
                          type="button"
                          style={S.removeBtn}
                          onClick={() => removeImage(slot.key)}
                          aria-label="Remove image"
                        >
                          X
                        </button>
                        {/* Quality badge overlay */}
                        {q && !q.uploading && !q.uploadFailed && (
                          <div style={{
                            ...S.qualityBadge,
                            background: q.qualityPassed ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
                          }}>
                            {q.qualityPassed ? '\u2713' : '\u2717'} {q.qualityScore ? `${Math.round(q.qualityScore)}%` : ''}
                          </div>
                        )}
                        {q?.uploading && (
                          <div style={S.qualityBadge}>
                            {t('pest.checking') || 'Checking...'}
                          </div>
                        )}
                      </div>
                      {/* Rejection reason + retry guidance */}
                      {q && !q.uploading && !q.qualityPassed && !q.uploadFailed && (
                        <div style={S.qualityWarning}>
                          <span style={{ fontWeight: 600 }}>{q.rejectionReason || (t('pest.lowQuality') || 'Image quality too low')}</span>
                          {q.retryGuidance && <span style={{ display: 'block', marginTop: '4px', opacity: 0.85 }}>{q.retryGuidance}</span>}
                          <span style={{ display: 'block', marginTop: '4px', fontWeight: 600 }}>
                            {t('pest.retakePhoto') || 'Remove and retake this photo.'}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <label style={S.captureLabel}>
                      <div style={S.captureIcon}>+</div>
                      <span style={S.captureLabelText}>{t(slot.labelKey)}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={S.hiddenInput}
                        onChange={(e) => handleImageCapture(slot.key, e)}
                      />
                    </label>
                  )}
                </div>
              );
            })}
            {/* Missing images hint */}
            {!allThreeImages && imageCount > 0 && (
              <p style={{ ...S.hint, marginTop: '0.75rem', color: COLORS.amber }}>
                {t('pest.morePhotosNeeded') || `${3 - imageCount} more photo(s) needed. All 3 types are required.`}
              </p>
            )}
          </div>
        )}

        {/* Step 3: Verification questions */}
        {step === 3 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t('pest.step3')}</h2>
            <p style={S.hint}>{t('pest.verifyHint')}</p>
            {QUESTIONS.map(q => (
              <div key={q.key} style={S.questionBlock}>
                <div style={S.questionText}>{t(q.labelKey)}</div>
                <div style={S.answerRow}>
                  {ANSWER_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      style={{
                        ...S.answerBtn,
                        background: answers[q.key] === opt ? COLORS.green : 'rgba(255,255,255,0.08)',
                        color: answers[q.key] === opt ? COLORS.text : COLORS.subtext,
                        borderColor: answers[q.key] === opt ? COLORS.green : 'rgba(255,255,255,0.15)',
                      }}
                      onClick={() => setAnswer(q.key, opt)}
                    >
                      {t(`pest.answer.${opt}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Review & submit */}
        {step === 4 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t('pest.step4')}</h2>
            <div style={S.reviewSection}>
              <div style={S.reviewRow}>
                <span style={S.reviewLabel}>{t('pest.cropType')}</span>
                <span style={S.reviewValue}>{t(`crop.${cropType}`)}</span>
              </div>
              <div style={S.reviewRow}>
                <span style={S.reviewLabel}>{t('pest.growthStage')}</span>
                <span style={S.reviewValue}>{t(`stage.${growthStage}`)}</span>
              </div>
              <div style={S.reviewRow}>
                <span style={S.reviewLabel}>{t('pest.photos')}</span>
                <span style={S.reviewValue}>{imageCount}/3</span>
              </div>
              <div style={S.reviewRow}>
                <span style={S.reviewLabel}>{t('pest.questionsAnswered')}</span>
                <span style={S.reviewValue}>{answeredCount}/6</span>
              </div>
            </div>

            {/* Image thumbnails */}
            {imageCount > 0 && (
              <div style={S.thumbRow}>
                {IMAGE_SLOTS.filter(sl => imagePreviews[sl.key]).map(sl => (
                  <img
                    key={sl.key}
                    src={imagePreviews[sl.key]}
                    alt={sl.icon}
                    style={S.thumbImg}
                  />
                ))}
              </div>
            )}

            {submitLoading && (
              <div style={S.loadingBox}>
                <div style={S.spinner} />
                <span style={{ color: COLORS.subtext }}>
                  {slowIndicator
                    ? (t('pest.stillWorking') || 'Still working...')
                    : t('pest.analyzing')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={S.navRow}>
          {step > 1 && (
            <button style={S.backBtn} onClick={back} disabled={submitLoading}>
              {t('pest.back')}
            </button>
          )}
          <button
            style={{
              ...S.nextBtn,
              opacity: canNext() && !submitLoading ? 1 : 0.5,
            }}
            onClick={next}
            disabled={!canNext() || submitLoading}
          >
            {step === TOTAL_STEPS ? t('pest.submit') : t('pest.next')}
          </button>
        </div>
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
  },
  offlineBanner: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid ' + COLORS.red,
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    color: COLORS.red,
    fontSize: '0.85rem',
    marginBottom: '1rem',
    textAlign: 'center',
    fontWeight: 600,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: COLORS.subtext,
    margin: '0 0 1.25rem',
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1.5rem',
    gap: '0',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
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
    margin: '0 4px',
  },
  card: {
    borderRadius: '16px',
    background: COLORS.card,
    border: '1px solid ' + COLORS.cardBorder,
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    marginBottom: '1rem',
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    margin: '0 0 1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: COLORS.subtext,
    marginBottom: '0.5rem',
    marginTop: '0.75rem',
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  chip: {
    padding: '10px 16px',
    border: '1.5px solid',
    borderRadius: '10px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'all 0.15s',
    background: 'none',
  },
  hint: {
    fontSize: '0.85rem',
    color: COLORS.muted,
    margin: '0 0 1rem',
  },
  uploadSlot: {
    marginBottom: '0.75rem',
  },
  captureLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    border: '1.5px dashed rgba(255,255,255,0.15)',
    cursor: 'pointer',
    minHeight: '60px',
  },
  captureIcon: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.4rem',
    fontWeight: 700,
    color: COLORS.green,
    background: COLORS.greenLight,
    borderRadius: '10px',
    flexShrink: 0,
  },
  captureLabelText: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#CBD5E1',
  },
  hiddenInput: {
    display: 'none',
  },
  previewWrap: {
    position: 'relative',
    borderRadius: '12px',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)',
  },
  previewImg: {
    width: '100%',
    height: '140px',
    objectFit: 'cover',
    display: 'block',
    borderRadius: '12px',
  },
  removeBtn: {
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
  questionBlock: {
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  questionText: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: '#E2E8F0',
    marginBottom: '0.5rem',
    lineHeight: 1.5,
  },
  answerRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  answerBtn: {
    flex: 1,
    padding: '10px 6px',
    border: '1.5px solid',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'all 0.15s',
  },
  reviewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  reviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  reviewLabel: {
    fontSize: '0.85rem',
    color: COLORS.subtext,
  },
  reviewValue: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#F1F5F9',
  },
  thumbRow: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  },
  thumbImg: {
    width: '72px',
    height: '54px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '1.5rem 0',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: COLORS.green,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  navRow: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  backBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: '10px',
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: COLORS.subtext,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
  },
  nextBtn: {
    flex: 2,
    padding: '14px',
    borderRadius: '10px',
    border: 'none',
    background: COLORS.green,
    color: COLORS.text,
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '48px',
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
  qualityBadge: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#fff',
    background: 'rgba(100,116,139,0.8)',
  },
  qualityWarning: {
    marginTop: '6px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    fontSize: '0.8rem',
    color: '#FCA5A5',
    lineHeight: 1.5,
  },
};
