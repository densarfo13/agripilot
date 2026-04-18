/**
 * CropFitIntake — short beginner intake flow for crop recommendation.
 *
 * 6 quick questions, one at a time, mobile-first.
 * Navigates to /crop-recommendations with answers in route state.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { safeTrackEvent } from '../lib/analytics.js';

// Resume state — intake progress survives app refresh / network loss.
const RESUME_KEY = 'farroway:cropfit_draft';
function saveDraft(step, answers) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ step, answers, ts: Date.now() }));
  } catch { /* ignore */ }
}
function loadDraft() {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire drafts older than 1h to avoid stale state
    if (!parsed || Date.now() - (parsed.ts || 0) > 60 * 60 * 1000) return null;
    if (typeof parsed.step !== 'number' || !parsed.answers) return null;
    return parsed;
  } catch { return null; }
}
function clearDraft() {
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
}

const STEPS = [
  { key: 'location',   icon: '\uD83D\uDCCD' },
  { key: 'experience', icon: '\uD83C\uDF31' },
  { key: 'landSize',   icon: '\uD83C\uDFDE\uFE0F' },
  { key: 'waterAccess', icon: '\uD83D\uDCA7' },
  { key: 'budget',     icon: '\uD83D\uDCB0' },
  { key: 'goal',       icon: '\uD83C\uDFAF' },
  { key: 'preferredCrop', icon: '\uD83C\uDF3E' },
];

const OPTIONS = {
  location: [
    { value: 'east_africa', labelKey: 'cropFit.loc.eastAfrica' },
    { value: 'west_africa', labelKey: 'cropFit.loc.westAfrica' },
    { value: 'southern_africa', labelKey: 'cropFit.loc.southernAfrica' },
    { value: 'central_africa', labelKey: 'cropFit.loc.centralAfrica' },
    { value: 'other', labelKey: 'cropFit.loc.other' },
  ],
  experience: [
    { value: 'none', labelKey: 'cropFit.exp.none' },
    { value: 'some', labelKey: 'cropFit.exp.some' },
    { value: 'experienced', labelKey: 'cropFit.exp.experienced' },
  ],
  landSize: [
    { value: 'small', labelKey: 'cropFit.land.small' },
    { value: 'medium', labelKey: 'cropFit.land.medium' },
    { value: 'large', labelKey: 'cropFit.land.large' },
  ],
  waterAccess: [
    { value: 'rain_only', labelKey: 'cropFit.water.rainOnly' },
    { value: 'well_or_river', labelKey: 'cropFit.water.wellRiver' },
    { value: 'irrigation', labelKey: 'cropFit.water.irrigation' },
  ],
  budget: [
    { value: 'low', labelKey: 'cropFit.budget.low' },
    { value: 'medium', labelKey: 'cropFit.budget.medium' },
    { value: 'high', labelKey: 'cropFit.budget.high' },
  ],
  goal: [
    { value: 'home_food', labelKey: 'cropFit.goal.homeFood' },
    { value: 'local_sales', labelKey: 'cropFit.goal.localSales' },
    { value: 'profit', labelKey: 'cropFit.goal.profit' },
  ],
  preferredCrop: [
    { value: '', labelKey: 'cropFit.pref.noPref' },
    { value: 'MAIZE', labelKey: 'cropFit.pref.maize' },
    { value: 'BEAN', labelKey: 'cropFit.pref.bean' },
    { value: 'CASSAVA', labelKey: 'cropFit.pref.cassava' },
    { value: 'TOMATO', labelKey: 'cropFit.pref.tomato' },
    { value: 'RICE', labelKey: 'cropFit.pref.rice' },
  ],
};

export default function CropFitIntake() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useProfile();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  // Restore partial intake if the user refreshed or lost network mid-flow.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      // Clamp step to valid range (STEPS length can change in later versions)
      const clamped = Math.max(0, Math.min(draft.step, STEPS.length - 1));
      setStep(clamped);
      setAnswers(draft.answers || {});
      safeTrackEvent('cropFit.intake_resumed', { step: clamped });
    }
  }, []);

  const current = STEPS[step];
  const options = OPTIONS[current.key];
  const isLast = step === STEPS.length - 1;
  // preferredCrop is optional — allow skip on that step
  const canSkip = current.key === 'preferredCrop';
  const progress = ((step + 1) / STEPS.length) * 100;

  function completeIntake(final) {
    clearDraft();
    safeTrackEvent('cropFit.intake_complete', final);
    navigate('/crop-recommendations', {
      state: { ...final, country: profile?.country || '' },
    });
  }

  function select(value) {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);

    safeTrackEvent('cropFit.answer', { step: current.key, value });

    if (isLast) {
      completeIntake(next);
    } else {
      const nextStep = step + 1;
      saveDraft(nextStep, next);
      setStep(nextStep);
    }
  }

  function skipCurrent() {
    if (!canSkip) return;
    const next = { ...answers, [current.key]: '' };
    safeTrackEvent('cropFit.skip', { step: current.key });
    if (isLast) {
      completeIntake(next);
    } else {
      const nextStep = step + 1;
      saveDraft(nextStep, next);
      setStep(nextStep);
      setAnswers(next);
    }
  }

  function goBack() {
    if (step > 0) {
      const prev = step - 1;
      setStep(prev);
      saveDraft(prev, answers);
    } else {
      clearDraft();
      navigate(-1);
    }
  }

  return (
    <div style={S.page}>
      {/* Progress bar */}
      <div style={S.progressBar}>
        <div style={{ ...S.progressFill, width: `${progress}%` }} />
      </div>

      <div style={S.card}>
        {/* Back */}
        <button type="button" onClick={goBack} style={S.backBtn}>
          {'\u2190'} {step > 0 ? t('common.back') : t('common.cancel')}
        </button>

        {/* Step indicator */}
        <div style={S.stepBadge}>
          {step + 1} / {STEPS.length}
        </div>

        {/* Icon + question */}
        <div style={S.iconWrap}>
          <span style={S.icon}>{current.icon}</span>
        </div>
        <h2 style={S.question}>{t(`cropFit.q.${current.key}`)}</h2>
        <p style={S.hint}>{t(`cropFit.hint.${current.key}`)}</p>

        {/* Options */}
        <div style={S.options}>
          {options.map((opt) => {
            const isSelected = answers[current.key] === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => select(opt.value)}
                style={{
                  ...S.optionBtn,
                  ...(isSelected ? S.optionSelected : {}),
                }}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Skip (only for optional questions) */}
        {canSkip && (
          <button type="button" onClick={skipCurrent} style={S.skipBtn}>
            {t('common.skipForNow')}
          </button>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 1rem 2rem',
  },
  progressBar: {
    width: '100%',
    maxWidth: '24rem',
    height: '4px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '2px',
    marginTop: '1rem',
    marginBottom: '1rem',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#22C55E',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  card: {
    width: '100%',
    maxWidth: '24rem',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1.5rem',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
    animation: 'farroway-fade-in 0.25s ease-out',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.25rem 0',
    marginBottom: '0.75rem',
    WebkitTapHighlightColor: 'transparent',
  },
  stepBadge: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'center',
    marginBottom: '0.75rem',
  },
  iconWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '0.75rem',
  },
  icon: { fontSize: '2.5rem' },
  question: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    textAlign: 'center',
    margin: '0 0 0.375rem',
    lineHeight: 1.3,
  },
  hint: {
    fontSize: '0.8125rem',
    color: '#6F8299',
    textAlign: 'center',
    margin: '0 0 1.25rem',
    lineHeight: 1.4,
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  optionBtn: {
    width: '100%',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  optionSelected: {
    background: 'rgba(34,197,94,0.1)',
    borderColor: '#22C55E',
    color: '#22C55E',
  },
  skipBtn: {
    width: '100%',
    marginTop: '0.625rem',
    padding: '0.625rem',
    borderRadius: '12px',
    border: '1px dashed rgba(255,255,255,0.08)',
    background: 'transparent',
    color: '#6F8299',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
};
