import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { uploadPestImage, createPestReport } from '../lib/intelligenceApi.js';

const CROPS = ['maize', 'cassava', 'rice', 'tomato', 'pepper', 'cocoa', 'yam', 'plantain'];
const STAGES = ['seedling', 'vegetative', 'flowering', 'fruiting', 'maturity'];
const IMAGE_SLOTS = [
  { key: 'leaf_closeup', labelKey: 'pest.photoLeaf' },
  { key: 'whole_plant', labelKey: 'pest.photoPlant' },
  { key: 'field_wide', labelKey: 'pest.photoField' },
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

export default function PestRiskCheck() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const profileId = profile?.id || profile?._id;

  const [step, setStep] = useState(1);
  const [cropType, setCropType] = useState('');
  const [growthStage, setGrowthStage] = useState('');
  const [images, setImages] = useState({ leaf_closeup: '', whole_plant: '', field_wide: '' });
  const [imageIds, setImageIds] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = 4;

  const setImage = useCallback((key, url) => {
    setImages(prev => ({ ...prev, [key]: url }));
  }, []);

  const setAnswer = useCallback((key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }, []);

  const canNext = () => {
    if (step === 1) return cropType && growthStage;
    if (step === 2) return Object.values(images).some(v => v.trim());
    if (step === 3) return Object.keys(answers).length >= 4;
    return true;
  };

  const handleUploadImages = async () => {
    const ids = [];
    for (const slot of IMAGE_SLOTS) {
      const url = images[slot.key]?.trim();
      if (url) {
        try {
          const res = await uploadPestImage({
            profileId,
            imageType: slot.key,
            imageUrl: url,
            gpsLat: null,
            gpsLng: null,
          });
          if (res.imageId) ids.push(res.imageId);
        } catch {
          // continue with remaining images
        }
      }
    }
    setImageIds(ids);
    return ids;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const ids = await handleUploadImages();
      const result = await createPestReport({
        profileId,
        imageIds: ids,
        cropCycleId: null,
        verificationAnswers: answers,
        notes: `Crop: ${cropType}, Stage: ${growthStage}`,
      });
      navigate('/pest-risk-result', { state: { report: result } });
    } catch (err) {
      setError(err.message || t('pest.submitError'));
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (step === 4) {
      handleSubmit();
      return;
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };
  const back = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <h1 style={S.title}>{t('pest.title')}</h1>
        <p style={S.subtitle}>{t('pest.subtitle')}</p>

        {/* Stepper */}
        <div style={S.stepper}>
          {[1, 2, 3, 4].map(n => (
            <div key={n} style={S.stepRow}>
              <div style={{ ...S.stepDot, background: n <= step ? '#22C55E' : 'rgba(255,255,255,0.15)', color: n <= step ? '#fff' : '#64748B' }}>
                {n < step ? '\u2713' : n}
              </div>
              {n < 4 && <div style={{ ...S.stepLine, background: n < step ? '#22C55E' : 'rgba(255,255,255,0.1)' }} />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <div style={S.errorBox}>{error}</div>}

        {/* Step 1: Crop info */}
        {step === 1 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t('pest.step1')}</h2>
            <label style={S.label}>{t('pest.cropType')}</label>
            <select
              style={S.select}
              value={cropType}
              onChange={e => setCropType(e.target.value)}
            >
              <option value="">{t('pest.selectCrop')}</option>
              {CROPS.map(c => <option key={c} value={c}>{t(`crop.${c}`)}</option>)}
            </select>

            <label style={S.label}>{t('pest.growthStage')}</label>
            <select
              style={S.select}
              value={growthStage}
              onChange={e => setGrowthStage(e.target.value)}
            >
              <option value="">{t('pest.selectStage')}</option>
              {STAGES.map(s => <option key={s} value={s}>{t(`stage.${s}`)}</option>)}
            </select>
          </div>
        )}

        {/* Step 2: Photo upload */}
        {step === 2 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>{t('pest.step2')}</h2>
            <p style={S.hint}>{t('pest.photoHint')}</p>
            {IMAGE_SLOTS.map(slot => (
              <div key={slot.key} style={S.uploadSlot}>
                <div style={S.uploadIcon}>
                  {images[slot.key] ? '\u2705' : '\uD83D\uDCF7'}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.uploadLabel}>{t(slot.labelKey)}</label>
                  <input
                    type="text"
                    placeholder={t('pest.imageUrlPlaceholder')}
                    style={S.input}
                    value={images[slot.key]}
                    onChange={e => setImage(slot.key, e.target.value)}
                  />
                </div>
                {images[slot.key] && (
                  <span style={S.qualityBadge}>{t('pest.uploaded')}</span>
                )}
              </div>
            ))}
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
                        background: answers[q.key] === opt ? '#22C55E' : 'rgba(255,255,255,0.08)',
                        color: answers[q.key] === opt ? '#fff' : '#94A3B8',
                        borderColor: answers[q.key] === opt ? '#22C55E' : 'rgba(255,255,255,0.15)',
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
                <span style={S.reviewValue}>{Object.values(images).filter(v => v.trim()).length}/3</span>
              </div>
              <div style={S.reviewRow}>
                <span style={S.reviewLabel}>{t('pest.questionsAnswered')}</span>
                <span style={S.reviewValue}>{Object.keys(answers).length}/6</span>
              </div>
            </div>

            {loading && (
              <div style={S.loadingBox}>
                <div style={S.spinner} />
                <span style={{ color: '#94A3B8' }}>{t('pest.analyzing')}</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={S.navRow}>
          {step > 1 && (
            <button style={S.backBtn} onClick={back} disabled={loading}>
              {t('pest.back')}
            </button>
          )}
          <button
            style={{ ...S.nextBtn, opacity: canNext() && !loading ? 1 : 0.5 }}
            onClick={next}
            disabled={!canNext() || loading}
          >
            {step === 4 ? t('pest.submit') : t('pest.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#94A3B8',
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
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
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
    color: '#94A3B8',
    marginBottom: '0.35rem',
    marginTop: '0.75rem',
  },
  select: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: '#0F172A',
    color: '#fff',
    appearance: 'none',
    minHeight: '44px',
  },
  hint: {
    fontSize: '0.85rem',
    color: '#64748B',
    margin: '0 0 1rem',
  },
  uploadSlot: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    marginBottom: '0.75rem',
  },
  uploadIcon: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.4rem',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '10px',
    flexShrink: 0,
  },
  uploadLabel: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#CBD5E1',
    marginBottom: '0.3rem',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '16px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#0F172A',
    color: '#fff',
    boxSizing: 'border-box',
  },
  qualityBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#22C55E',
    background: 'rgba(34,197,94,0.12)',
    padding: '3px 8px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
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
    gap: '0.75rem',
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
    color: '#94A3B8',
  },
  reviewValue: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#F1F5F9',
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
    borderTopColor: '#22C55E',
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
    color: '#94A3B8',
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
    background: '#22C55E',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '48px',
  },
  errorBox: {
    background: 'rgba(252,165,165,0.1)',
    border: '1px solid #FCA5A5',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
};
