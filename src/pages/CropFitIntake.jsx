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

// ─── Onboarding flow (V2) ──────────────────────────────────
// Four steps total: location → country → experience → land.
// Country is REQUIRED before the flow can complete. The "My country
// is not listed" option at the region step still advances to the
// country step (full list) — the previous bug that skipped country
// selection is fixed by making the country step unconditional.

const STEPS = [
  { key: 'location',   icon: '\uD83D\uDCCD' },
  { key: 'country',    icon: '\uD83C\uDF0D' },
  { key: 'experience', icon: '\uD83C\uDF31' },
  { key: 'land',       icon: '\uD83D\uDE9C' },
];

// Country lists per region. `other` region shows the combined /
// expanded list. Country names use their local English spelling —
// proper nouns that render fine across all supported languages.
const COUNTRIES_BY_REGION = {
  east_africa: [
    { value: 'KE', label: 'Kenya' },
    { value: 'TZ', label: 'Tanzania' },
    { value: 'UG', label: 'Uganda' },
    { value: 'RW', label: 'Rwanda' },
    { value: 'ET', label: 'Ethiopia' },
    { value: 'BI', label: 'Burundi' },
  ],
  west_africa: [
    { value: 'GH', label: 'Ghana' },
    { value: 'NG', label: 'Nigeria' },
    { value: 'CI', label: "Côte d'Ivoire" },
    { value: 'SN', label: 'Senegal' },
    { value: 'BF', label: 'Burkina Faso' },
    { value: 'BJ', label: 'Benin' },
    { value: 'ML', label: 'Mali' },
    { value: 'TG', label: 'Togo' },
    { value: 'CM', label: 'Cameroon' },
    { value: 'LR', label: 'Liberia' },
    { value: 'SL', label: 'Sierra Leone' },
    { value: 'GN', label: 'Guinea' },
  ],
  southern_africa: [
    { value: 'ZA', label: 'South Africa' },
    { value: 'ZM', label: 'Zambia' },
    { value: 'ZW', label: 'Zimbabwe' },
    { value: 'MW', label: 'Malawi' },
    { value: 'MZ', label: 'Mozambique' },
  ],
  central_africa: [
    { value: 'CM', label: 'Cameroon' },
    { value: 'CD', label: 'DR Congo' },
    { value: 'CG', label: 'Republic of Congo' },
    { value: 'CF', label: 'Central African Republic' },
    { value: 'GA', label: 'Gabon' },
  ],
  // Full / expanded list for "My country is not listed".
  other: [
    { value: 'IN', label: 'India' },
    { value: 'US', label: 'United States' },
    { value: 'BR', label: 'Brazil' },
    { value: 'ID', label: 'Indonesia' },
    { value: 'PH', label: 'Philippines' },
    { value: 'VN', label: 'Vietnam' },
    { value: 'TH', label: 'Thailand' },
    { value: 'BD', label: 'Bangladesh' },
    { value: 'PK', label: 'Pakistan' },
    { value: 'EG', label: 'Egypt' },
    { value: 'MX', label: 'Mexico' },
    { value: 'CO', label: 'Colombia' },
    { value: 'PE', label: 'Peru' },
    { value: 'KE', label: 'Kenya' },
    { value: 'GH', label: 'Ghana' },
    { value: 'NG', label: 'Nigeria' },
    { value: 'ZA', label: 'South Africa' },
    { value: 'IN', label: 'India' },
  ],
};

// Safe defaults for the intake values we no longer ask up-front.
// The recommendation engine still reads them; these sensible
// defaults keep top-3 output useful without adding onboarding taps.
const INTAKE_DEFAULTS = Object.freeze({
  landSize: 'medium',
  waterAccess: 'rain_only',
  budget: 'low',
  goal: 'local_sales',
});

const OPTIONS = {
  location: [
    { value: 'east_africa', labelKey: 'cropFit.loc.eastAfrica' },
    { value: 'west_africa', labelKey: 'cropFit.loc.westAfrica' },
    { value: 'southern_africa', labelKey: 'cropFit.loc.southernAfrica' },
    { value: 'central_africa', labelKey: 'cropFit.loc.centralAfrica' },
    { value: 'other', labelKey: 'cropFit.loc.other' },
  ],
  // `country` options are resolved dynamically from the answer to
  // `location` — handled in the render pass.
  experience: [
    { value: 'none', labelKey: 'cropFit.exp.none' },
    { value: 'some', labelKey: 'cropFit.exp.some' },
    { value: 'experienced', labelKey: 'cropFit.exp.experienced' },
  ],
  land: [
    { value: 'cleared', labelKey: 'cropFit.land.cleared' },
    { value: 'not_cleared', labelKey: 'cropFit.land.notCleared' },
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
  const isLast = step === STEPS.length - 1;
  // Land state can be skipped; country is never skippable.
  const canSkip = current.key === 'land';

  // Country options depend on the region picked at step 1. If no
  // region picked yet (shouldn't happen — step order enforces it),
  // fall back to the full "other" list rather than an empty state.
  const options = current.key === 'country'
    ? (COUNTRIES_BY_REGION[answers.location] || COUNTRIES_BY_REGION.other)
    : OPTIONS[current.key];

  function completeIntake(final) {
    if (!final.country) {
      if (import.meta.env?.DEV) {
        console.warn('[CropFitIntake] blocking complete — no country selected');
      }
      safeTrackEvent('cropFit.block_no_country', {});
      return;
    }
    clearDraft();
    safeTrackEvent('cropFit.intake_complete', final);
    navigate('/crop-recommendations', {
      state: {
        ...INTAKE_DEFAULTS,
        ...final,
        country: final.country,
      },
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
    const next = { ...answers, [current.key]: 'unknown' };
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

  // Soft progress — width only; no explicit total number in UI.
  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div style={S.page}>
      {/* Progress bar — soft, no label */}
      <div style={S.progressBar}>
        <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
      </div>

      <div style={S.card}>
        {/* Back */}
        <button type="button" onClick={goBack} style={S.backBtn}>
          {'\u2190'} {step > 0 ? t('common.back') : t('common.cancel')}
        </button>

        {/* Soft step indicator — "Step N" without a total count
            so onboarding never feels long. */}
        <div style={S.stepBadge}>
          {t('common.stepN', { n: step + 1 })}
        </div>

        {/* Icon + question */}
        <div style={S.iconWrap}>
          <span style={S.icon}>{current.icon}</span>
        </div>
        <h2 style={S.question}>{t(`cropFit.q.${current.key}`)}</h2>
        <p style={S.hint}>{t(`cropFit.hint.${current.key}`)}</p>

        {/* Options — country step uses raw proper-noun labels;
            other steps use translation keys. */}
        <div style={S.options}>
          {options.map((opt, i) => {
            const isSelected = answers[current.key] === opt.value;
            const label = opt.labelKey ? t(opt.labelKey) : (opt.label || opt.value);
            return (
              <button
                key={`${opt.value}-${i}`}
                type="button"
                onClick={() => select(opt.value)}
                style={{
                  ...S.optionBtn,
                  ...(isSelected ? S.optionSelected : {}),
                }}
              >
                {label}
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
