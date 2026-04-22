/**
 * NewFarmerRecommendation — inline guided recommendation for new farmers.
 *
 * Shown inside OnboardingWizard when experienceLevel === 'new'.
 * Asks 4 simple questions, then shows a structured recommendation:
 *   - Primary crop (with reasons)
 *   - 2 alternatives
 *   - Suggested starting size (with explanation)
 *
 * On "Use this plan" → calls onResult({ crop, farmSizeCategory }) to prefill the wizard.
 * On "Choose myself" → calls onSkip() to go straight to crop selection.
 *
 * Mobile-first. Large buttons. Simple wording.
 */
import { useState } from 'react';
import { recommendForNewFarmer } from '../engine/newFarmerRecommendation.js';
import CropImage from './CropImage.jsx';
import { assessSeasonProfit } from '../engine/seasonProfitRules.js';

// ─── Question definitions ───────────────────────────────────
const QUESTIONS = [
  { key: 'goal', icon: '\uD83C\uDFAF' },
  { key: 'landSize', icon: '\uD83C\uDFDE\uFE0F' },
  { key: 'budget', icon: '\uD83D\uDCB0' },
  { key: 'preferredCrop', icon: '\uD83C\uDF3E' },
];

const OPTIONS = {
  goal: [
    { value: 'home_food', icon: '\uD83C\uDF5A' },
    { value: 'local_sales', icon: '\uD83D\uDED2' },
    { value: 'profit', icon: '\uD83D\uDCB0' },
  ],
  landSize: [
    { value: 'small', icon: '\uD83C\uDF31' },
    { value: 'medium', icon: '\uD83C\uDF3E' },
    { value: 'large', icon: '\uD83C\uDFE1' },
  ],
  budget: [
    { value: 'low', icon: '\uD83D\uDCB5' },
    { value: 'medium', icon: '\uD83D\uDCB5\uD83D\uDCB5' },
    { value: 'high', icon: '\uD83D\uDCB5\uD83D\uDCB5\uD83D\uDCB5' },
  ],
  preferredCrop: [
    { value: '', icon: '\uD83E\uDD37' },
    { value: 'MAIZE', icon: '\uD83C\uDF3D' },
    { value: 'BEAN', icon: '\uD83E\uDED8' },
    { value: 'CASSAVA', icon: '\uD83E\uDD54' },
    { value: 'TOMATO', icon: '\uD83C\uDF45' },
    { value: 'RICE', icon: '\uD83C\uDF3E' },
  ],
};

// ─── Crop display data ───────────────────────────────────────
const CROP_ICONS = {
  MAIZE: '\uD83C\uDF3D', BEAN: '\uD83E\uDED8', CASSAVA: '\uD83E\uDD54',
  TOMATO: '\uD83C\uDF45', RICE: '\uD83C\uDF3E', GROUNDNUT: '\uD83E\uDD5C',
  SWEET_POTATO: '\uD83C\uDF60', SORGHUM: '\uD83C\uDF3F', MILLET: '\uD83C\uDF3E',
  COWPEA: '\uD83E\uDED8', YAM: '\uD83E\uDD54', PLANTAIN: '\uD83C\uDF4C',
  BANANA: '\uD83C\uDF4C', OKRA: '\uD83E\uDD6C', PEPPER: '\uD83C\uDF36\uFE0F',
  KALE: '\uD83E\uDD6C', CABBAGE: '\uD83E\uDD6C', POTATO: '\uD83E\uDD54',
  ONION: '\uD83E\uDDC5', MANGO: '\uD83E\uDD6D', SPINACH: '\uD83E\uDD6C',
  CARROT: '\uD83E\uDD55', CUCUMBER: '\uD83E\uDD52', WATERMELON: '\uD83C\uDF49',
  EGGPLANT: '\uD83C\uDF46', CHILI: '\uD83C\uDF36\uFE0F', PAPAYA: '\uD83E\uDD6D',
  SESAME: '\uD83C\uDF3E', SOYBEAN: '\uD83E\uDED8', WHEAT: '\uD83C\uDF3E',
};

const CROP_LABEL_KEY = {
  MAIZE: 'crop.maize', BEAN: 'crop.beans', CASSAVA: 'crop.cassava',
  TOMATO: 'crop.tomato', RICE: 'crop.rice', GROUNDNUT: 'crop.groundnut',
  SWEET_POTATO: 'crop.sweetPotato', SORGHUM: 'crop.sorghum', MILLET: 'crop.millet',
  COWPEA: 'crop.cowpea', YAM: 'crop.yam', PLANTAIN: 'crop.plantain',
  BANANA: 'crop.banana', OKRA: 'crop.okra', PEPPER: 'crop.pepper',
  KALE: 'crop.kale', CABBAGE: 'crop.cabbage', POTATO: 'crop.potato',
  ONION: 'crop.onion', MANGO: 'crop.mango', SPINACH: 'crop.spinach',
  CARROT: 'crop.carrot', CUCUMBER: 'crop.cucumber', WATERMELON: 'crop.watermelon',
  EGGPLANT: 'crop.eggplant', CHILI: 'crop.chili', PAPAYA: 'crop.papaya',
  SESAME: 'crop.sesame', SOYBEAN: 'crop.soybean', WHEAT: 'crop.wheat',
};

// Pick the top 2 positive-weight reasons for display
function topReasons(reasons) {
  return reasons
    .filter(r => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2);
}

// ─── Component ───────────────────────────────────────────────
export default function NewFarmerRecommendation({ t, countryCode, onResult, onSkip }) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState(null);

  const current = QUESTIONS[qIndex];
  const options = OPTIONS[current?.key] || [];
  const progress = showResults ? 100 : Math.round(((qIndex + 1) / QUESTIONS.length) * 100);

  function handleSelect(value) {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);

    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      setShowResults(true);
    }
  }

  function handleBack() {
    if (showResults) {
      setShowResults(false);
      setSelectedCrop(null);
      return;
    }
    if (qIndex > 0) setQIndex(qIndex - 1);
  }

  function handleUsePlan(cropCode, sizeCategory) {
    onResult({
      crop: cropCode,
      farmSizeCategory: sizeCategory,
      experienceLevel: 'new',
    });
  }

  // ─── Results screen ──────────────────────────────────────
  if (showResults) {
    const result = recommendForNewFarmer({
      countryCode,
      goal: answers.goal,
      landSize: answers.landSize,
      budget: answers.budget,
      preferredCrop: answers.preferredCrop,
      isNew: true,
    });

    const { primary, alternatives, suggestedSize } = result;
    const activeCrop = selectedCrop || primary?.code;
    const activeEntry = activeCrop === primary?.code
      ? primary
      : alternatives.find(a => a.code === activeCrop) || primary;

    return (
      <div style={RS.wrap}>
        <div style={RS.header}>
          <span style={RS.headerIcon}>{'\u2728'}</span>
          <h2 style={RS.title}>{t('recommend.title')}</h2>
          <p style={RS.subtitle}>{t('recommend.subtitle')}</p>
        </div>

        {/* ── Primary recommendation ── */}
        {primary && (
          <div style={RS.section}>
            <div style={RS.sectionLabel}>{t('recommend.recommendedForYou')}</div>
            <button
              type="button"
              onClick={() => setSelectedCrop(primary.code)}
              style={{
                ...RS.cropCard,
                borderColor: activeCrop === primary.code ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                background: activeCrop === primary.code ? 'rgba(34,197,94,0.10)' : '#1E293B',
              }}
            >
              <div style={RS.cropTop}>
                <span style={RS.bestBadge}>{t('recommend.bestMatch')}</span>
                <CropImage
                  cropKey={primary.code}
                  alt={t(CROP_LABEL_KEY[primary.code] || `crop.${primary.code.toLowerCase()}`)}
                  size={40}
                  circular
                />
                <span style={RS.cropName}>{t(CROP_LABEL_KEY[primary.code] || `crop.${primary.code.toLowerCase()}`)}</span>
                {activeCrop === primary.code && <span style={RS.checkMark}>{'\u2713'}</span>}
              </div>
              <div style={RS.cropWhy}>{t(primary.whyKey)}</div>
              <div style={RS.reasonTags}>
                {topReasons(primary.reasons).map(r => (
                  <span key={r.key} style={RS.reasonTag}>{t(r.key)}</span>
                ))}
              </div>
            </button>
          </div>
        )}

        {/* ── Alternatives ── */}
        {alternatives.length > 0 && (
          <div style={RS.section}>
            <div style={RS.sectionLabel}>{t('recommend.alsoGoodOptions')}</div>
            <div style={RS.altList}>
              {alternatives.map(crop => {
                const isActive = activeCrop === crop.code;
                return (
                  <button
                    key={crop.code}
                    type="button"
                    onClick={() => setSelectedCrop(crop.code)}
                    style={{
                      ...RS.cropCard,
                      borderColor: isActive ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                      background: isActive ? 'rgba(34,197,94,0.10)' : '#1E293B',
                    }}
                  >
                    <div style={RS.cropTop}>
                      <span style={RS.cropIcon}>{CROP_ICONS[crop.code] || '\uD83C\uDF3F'}</span>
                      <span style={RS.cropName}>{t(CROP_LABEL_KEY[crop.code] || `crop.${crop.code.toLowerCase()}`)}</span>
                      {isActive && <span style={RS.checkMark}>{'\u2713'}</span>}
                    </div>
                    <div style={RS.cropWhy}>{t(crop.whyKey)}</div>
                    <div style={RS.reasonTags}>
                      {topReasons(crop.reasons).map(r => (
                        <span key={r.key} style={RS.reasonTag}>{t(r.key)}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Suggested starting size ── */}
        <div style={RS.sizeCard}>
          <div style={RS.sizeCardHeader}>
            <span style={RS.sizeIcon}>{'\uD83D\uDCCF'}</span>
            <span style={RS.sizeTitle}>{t('recommend.suggestedStartingSize')}</span>
          </div>
          <div style={RS.sizeValue}>
            {t(`recommend.size.${suggestedSize.size}`)}
          </div>
          <div style={RS.sizeReason}>
            {t(suggestedSize.reasonKey)}
          </div>
        </div>

        {/* ── Season & profit guidance ── */}
        {activeCrop && (() => {
          const season = assessSeasonProfit({
            cropCode: activeCrop,
            countryCode,
            goal: answers.goal,
            isNew: true,
            landSize: answers.landSize,
          });
          const fitIcon = season.seasonFit === 'good' ? '\u2705' : season.seasonFit === 'okay' ? '\uD83D\uDFE1' : '\uD83D\uDFE0';
          const fitAccent = season.seasonFit === 'good' ? '#22C55E' : season.seasonFit === 'okay' ? '#EAB308' : '#F97316';
          const fitBg = season.seasonFit === 'good' ? 'rgba(34,197,94,0.06)' : season.seasonFit === 'okay' ? 'rgba(234,179,8,0.06)' : 'rgba(249,115,22,0.06)';
          const fitBorder = season.seasonFit === 'good' ? 'rgba(34,197,94,0.15)' : season.seasonFit === 'okay' ? 'rgba(234,179,8,0.15)' : 'rgba(249,115,22,0.15)';

          return (
            <div style={{ ...RS.seasonCard, background: fitBg, borderColor: fitBorder }}>
              <div style={RS.seasonCardHeader}>
                <span style={{ fontSize: '1rem' }}>{fitIcon}</span>
                <span style={{ ...RS.seasonTitle, color: fitAccent }}>{t('seasonGuide.timingLabel')}</span>
              </div>
              <div style={RS.seasonMessage}>{t(season.messageKey)}</div>
              <div style={RS.seasonMeta}>
                <span style={{ ...RS.seasonBadge, color: fitAccent, borderColor: fitAccent + '30', background: fitAccent + '10' }}>
                  {t(`seasonGuide.fit.${season.seasonFit}`)}
                </span>
                <span style={RS.seasonBadgeNeutral}>
                  {t(`seasonGuide.profit.${season.profitFit}`)}
                </span>
                <span style={RS.seasonBadgeNeutral}>
                  {t(`seasonGuide.risk.${season.riskLevel}`)}
                </span>
              </div>
              {season.alternatives.length > 0 && (
                <div style={RS.seasonAlts}>
                  <div style={RS.seasonAltsLabel}>{t('seasonGuide.betterNow')}</div>
                  <div style={RS.seasonAltsList}>
                    {season.alternatives.map(alt => (
                      <button
                        key={alt.code}
                        type="button"
                        onClick={() => setSelectedCrop(alt.code)}
                        style={RS.seasonAltBtn}
                      >
                        <span>{CROP_ICONS[alt.code] || '\uD83C\uDF3F'}</span>
                        <span>{t(CROP_LABEL_KEY[alt.code] || `crop.${alt.code.toLowerCase()}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Action buttons ── */}
        <div style={RS.btnRow}>
          <button type="button" onClick={handleBack} style={RS.backBtn}>
            {t('common.back')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeEntry) {
                handleUsePlan(activeEntry.code, suggestedSize.size);
              }
            }}
            style={{ ...RS.primaryBtn, opacity: activeEntry ? 1 : 0.5 }}
          >
            {t('recommend.useThisPlan')}
          </button>
        </div>
        <button type="button" onClick={onSkip} style={RS.skipBtn}>
          {t('recommend.chooseMyself')}
        </button>
      </div>
    );
  }

  // ─── Question screens ────────────────────────────────────
  return (
    <div style={RS.wrap}>
      {/* Progress */}
      <div style={RS.progressWrap}>
        <div style={RS.progressBar}>
          <div style={{ ...RS.progressFill, width: `${progress}%` }} />
        </div>
      </div>

      <div style={RS.header}>
        <span style={RS.headerIcon}>{current.icon}</span>
        <h2 style={RS.title}>{t(`recommend.q.${current.key}`)}</h2>
        <p style={RS.subtitle}>{t(`recommend.q.${current.key}Hint`)}</p>
      </div>

      <div style={RS.optionGrid}>
        {options.map(opt => {
          const isSelected = answers[current.key] === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              style={{
                ...RS.optionBtn,
                borderColor: isSelected ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                background: isSelected ? 'rgba(34,197,94,0.10)' : '#1E293B',
              }}
            >
              <span style={RS.optionIcon}>{opt.icon}</span>
              <span style={{ color: isSelected ? '#86EFAC' : '#FFFFFF', fontWeight: isSelected ? 600 : 400, fontSize: '0.9rem' }}>
                {t(`recommend.opt.${current.key}.${opt.value || 'none'}`)}
              </span>
            </button>
          );
        })}
      </div>

      <div style={RS.btnRow}>
        {qIndex > 0 && (
          <button type="button" onClick={handleBack} style={RS.backBtn}>
            {t('common.back')}
          </button>
        )}
        <button type="button" onClick={onSkip} style={RS.skipLink}>
          {t('recommend.skipGuide')}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const RS = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%',
  },
  progressWrap: { width: '100%', marginBottom: '1rem' },
  progressBar: {
    width: '100%', height: 4, background: '#243041', borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: '#22C55E', borderRadius: 2, transition: 'width 0.3s ease',
  },
  header: {
    textAlign: 'center', marginBottom: '1rem',
  },
  headerIcon: { fontSize: '2rem', display: 'block', marginBottom: '0.3rem' },
  title: {
    margin: '0 0 0.35rem', fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF',
  },
  subtitle: {
    margin: 0, fontSize: '0.85rem', color: '#A1A1AA', lineHeight: 1.5,
  },
  optionGrid: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%',
    marginBottom: '0.75rem',
  },
  optionBtn: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.9rem 1rem', minHeight: '56px',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
    cursor: 'pointer', background: '#1E293B',
    WebkitTapHighlightColor: 'transparent', width: '100%', textAlign: 'left',
  },
  optionIcon: { fontSize: '1.4rem', flexShrink: 0 },
  btnRow: {
    display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem',
  },
  backBtn: {
    padding: '0.75rem 1.2rem', background: 'transparent', color: '#A1A1AA',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px',
    fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
  },
  skipLink: {
    flex: 1, padding: '0.75rem', background: 'transparent', color: '#71717A',
    border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px',
    fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', minHeight: '52px',
    WebkitTapHighlightColor: 'transparent', textAlign: 'center',
  },
  skipBtn: {
    width: '100%', padding: '0.6rem', background: 'transparent', color: '#71717A',
    border: 'none', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
    marginTop: '0.5rem', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  primaryBtn: {
    flex: 1, padding: '0.75rem', background: '#22C55E', color: '#fff', border: 'none',
    borderRadius: '10px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
    minHeight: '52px', WebkitTapHighlightColor: 'transparent',
  },
  // ─── Results ───
  section: { width: '100%', marginBottom: '0.75rem' },
  sectionLabel: {
    fontSize: '0.72rem', fontWeight: 700, color: '#22C55E', textTransform: 'uppercase',
    letterSpacing: '0.04em', marginBottom: '0.35rem', paddingLeft: '0.1rem',
  },
  altList: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  cropCard: {
    display: 'flex', flexDirection: 'column', gap: '0.35rem',
    padding: '1rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
    cursor: 'pointer', background: '#1E293B', width: '100%', textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
  },
  cropTop: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  },
  cropIcon: { fontSize: '1.5rem' },
  cropName: { fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', flex: 1 },
  checkMark: { color: '#22C55E', fontSize: '1rem', fontWeight: 700 },
  cropWhy: {
    fontSize: '0.8rem', color: '#9FB3C8', lineHeight: 1.4, marginTop: '0.15rem',
  },
  reasonTags: {
    display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem',
  },
  reasonTag: {
    fontSize: '0.65rem', fontWeight: 600, color: '#86EFAC',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)',
    borderRadius: '6px', padding: '0.15rem 0.45rem',
  },
  bestBadge: {
    fontSize: '0.6rem', fontWeight: 700, color: '#22C55E', textTransform: 'uppercase',
    letterSpacing: '0.04em', background: 'rgba(34,197,94,0.12)',
    padding: '0.15rem 0.5rem', borderRadius: '6px',
  },
  // ─── Size card ───
  sizeCard: {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
    background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)',
    marginBottom: '0.75rem',
  },
  sizeCardHeader: {
    display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem',
  },
  sizeIcon: { fontSize: '1rem' },
  sizeTitle: {
    fontSize: '0.72rem', fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sizeValue: {
    fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.2rem',
  },
  sizeReason: {
    fontSize: '0.78rem', color: '#7DD3FC', lineHeight: 1.4,
  },
  // ─── Season card ───
  seasonCard: {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
    border: '1px solid', marginBottom: '0.75rem',
  },
  seasonCardHeader: {
    display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem',
  },
  seasonTitle: {
    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  seasonMessage: {
    fontSize: '0.85rem', color: '#E2E8F0', lineHeight: 1.45, marginBottom: '0.4rem',
  },
  seasonMeta: {
    display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.3rem',
  },
  seasonBadge: {
    fontSize: '0.62rem', fontWeight: 700, borderRadius: '5px',
    padding: '0.1rem 0.4rem', border: '1px solid',
  },
  seasonBadgeNeutral: {
    fontSize: '0.62rem', fontWeight: 600, color: '#A1A1AA', borderRadius: '5px',
    padding: '0.1rem 0.4rem', border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  seasonAlts: {
    marginTop: '0.4rem', paddingTop: '0.4rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  seasonAltsLabel: {
    fontSize: '0.7rem', fontWeight: 700, color: '#F59E0B', marginBottom: '0.3rem',
  },
  seasonAltsList: {
    display: 'flex', flexWrap: 'wrap', gap: '0.35rem',
  },
  seasonAltBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.3rem 0.6rem', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
    color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 500,
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
};
