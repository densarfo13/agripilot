/**
 * CropSummary — A-Z crop operating plan for beginners.
 *
 * Sections:
 *   A. Overview (name, difficulty, harvest time, water, effort)
 *   B. Main stages (6 simplified crop stages)
 *   C. What you need (seeds, fertilizer, water, tools, labor)
 *   D. Main risks (adapted by crop)
 *   E. Simple economics (cost, labor, market potential)
 *   F. Why this crop fits you (from intake answers)
 *   G. Start CTA
 *
 * NOT an encyclopedia. Short, icon-first, actionable.
 */
import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getCropProfile } from '../data/cropProfiles.js';
import { saveFarmProfile, createNewFarm, saveFarmerType, updateCropStage } from '../lib/api.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { getInitialTask } from '../engine/cropTaskMap.js';

const STAGE_ICONS = {
  land_prep: '\uD83D\uDE9C',
  planting: '\uD83C\uDF31',
  early_growth: '\uD83C\uDF3F',
  maintenance: '\uD83D\uDEE1\uFE0F',
  harvest: '\uD83E\uDDFA',
  post_harvest: '\uD83D\uDCE6',
};

const NEED_ICONS = {
  seeds: '\uD83C\uDF31', cuttings: '\uD83C\uDF31', vine_cuttings: '\uD83C\uDF31',
  suckers: '\uD83C\uDF31', seedlings: '\uD83C\uDF31', seed_potatoes: '\uD83E\uDD54',
  fertilizer: '\uD83E\uDDEA', water: '\uD83D\uDCA7', labor: '\uD83D\uDC68\u200D\uD83C\uDF3E',
  basic_tools: '\uD83E\uDE93', pesticide: '\uD83D\uDEE1\uFE0F', stakes: '\uD83E\uDEB5',
  shade_trees: '\uD83C\uDF33', transport: '\uD83D\uDE9A',
};

const RISK_ICONS = {
  drought: '\u2600\uFE0F', pests: '\uD83D\uDC1B', disease: '\uD83E\uDDA0',
  poor_storage: '\uD83D\uDCE6', low_market_price: '\uD83D\uDCC9',
};

const LEVEL_COLORS = {
  low: '#22C55E', moderate: '#F59E0B', high: '#EF4444',
};
const DIFF_COLORS = {
  beginner: '#22C55E', moderate: '#F59E0B', advanced: '#EF4444',
};

export default function CropSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { profile, refreshProfile, refreshFarms } = useProfile();
  const { isOnline } = useNetwork();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const crop = location.state?.crop;
  const answers = location.state?.answers;
  if (!crop) return <Navigate to="/crop-fit" replace />;

  const cp = getCropProfile(crop.code);
  if (!cp) return <Navigate to="/crop-recommendations" replace />;

  // ─── Start crop plan ────────────────────────────────────
  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setError('');
    safeTrackEvent('cropFit.start_plan', { code: crop.code });

    try {
      // 1. Save crop to farm profile
      if (profile?.id) {
        await saveFarmProfile({
          farmerName: profile.farmerName || profile.fullName || '',
          farmName: profile.farmName || 'My Farm',
          country: profile.country || answers?.country || '',
          location: profile.location || '',
          size: profile.size || '1',
          sizeUnit: profile.sizeUnit || 'ACRE',
          cropType: crop.code,
        });
      } else {
        // No existing profile — create one with minimal info
        await createNewFarm({
          farmerName: '',
          farmName: 'My Farm',
          country: answers?.country || '',
          location: '',
          size: answers?.landSize === 'small' ? '1' : answers?.landSize === 'large' ? '20' : '5',
          sizeUnit: 'ACRE',
          cropType: crop.code,
        });
      }

      // 2. Save experience level
      if (answers?.experience) {
        const farmerType = answers.experience === 'none' ? 'new' : 'experienced';
        await saveFarmerType(farmerType).catch(() => {});
      }

      // 3. Refresh profile to get new farm ID
      const freshProfile = await refreshProfile();
      await refreshFarms?.();

      // 4. Set initial crop stage to land_preparation (first active stage)
      const farmId = freshProfile?.id || profile?.id;
      if (farmId) {
        await updateCropStage(farmId, 'land_preparation').catch(() => {});
        await refreshProfile();
      }

      // 5. Get the initial task for tracking/analytics
      const initialTask = getInitialTask(crop.code, 'land_preparation');
      safeTrackEvent('cropFit.plan_started', {
        code: crop.code,
        initialTaskType: initialTask.type,
        stage: 'land_preparation',
      });

      // 6. Navigate to Home — daily guidance begins immediately
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || t('common.error'));
      setStarting(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Back */}
        <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
          {'\u2190'} {t('common.back')}
        </button>

        {/* ═══ A. OVERVIEW ═══ */}
        <div style={S.overviewCard}>
          <span style={S.overviewIcon}>{cp.icon}</span>
          <h1 style={S.cropName}>{crop.name}</h1>
          <div style={{ ...S.diffBadge, background: DIFF_COLORS[cp.difficulty] + '18', color: DIFF_COLORS[cp.difficulty] }}>
            {t(`cropFit.diff.${cp.difficulty}`)}
          </div>

          <div style={S.overviewStats}>
            <div style={S.oStat}>
              <span style={S.oStatIcon}>{'\u23F1\uFE0F'}</span>
              <span style={S.oStatLabel}>{t('cropSummary.harvestTime')}</span>
              <span style={S.oStatValue}>{cp.harvestWeeksMin}–{cp.harvestWeeksMax} {t('cropFit.weeks')}</span>
            </div>
            <div style={S.oStat}>
              <span style={S.oStatIcon}>{'\uD83D\uDCA7'}</span>
              <span style={S.oStatLabel}>{t('cropSummary.waterNeed')}</span>
              <span style={{ ...S.oStatValue, color: LEVEL_COLORS[cp.waterNeed] }}>{t(`cropFit.level.${cp.waterNeed}`)}</span>
            </div>
            <div style={S.oStat}>
              <span style={S.oStatIcon}>{'\uD83D\uDCAA'}</span>
              <span style={S.oStatLabel}>{t('cropSummary.effort')}</span>
              <span style={{ ...S.oStatValue, color: LEVEL_COLORS[cp.effortLevel] }}>{t(`cropFit.level.${cp.effortLevel}`)}</span>
            </div>
          </div>
        </div>

        {/* ═══ B. MAIN STAGES ═══ */}
        <Section icon={'\uD83D\uDCCB'} title={t('cropSummary.stages')}>
          <div style={S.stageList}>
            {cp.stages.map((stage, i) => (
              <div key={stage} style={S.stageRow}>
                <span style={S.stageNum}>{i + 1}</span>
                <span style={S.stageIcon}>{STAGE_ICONS[stage] || '\uD83C\uDF3E'}</span>
                <span style={S.stageText}>{t(`cropSummary.stage.${stage}`)}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ═══ C. WHAT YOU NEED ═══ */}
        <Section icon={'\uD83E\uDDF0'} title={t('cropSummary.whatYouNeed')}>
          <div style={S.needsGrid}>
            {cp.needs.map((need) => (
              <div key={need} style={S.needChip}>
                <span>{NEED_ICONS[need] || '\uD83D\uDCE6'}</span>
                <span>{t(`cropSummary.need.${need}`)}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ═══ D. MAIN RISKS ═══ */}
        <Section icon={'\u26A0\uFE0F'} title={t('cropSummary.mainRisks')}>
          <div style={S.riskList}>
            {cp.risks.map((risk) => (
              <div key={risk} style={S.riskRow}>
                <span style={S.riskIcon}>{RISK_ICONS[risk] || '\u26A0\uFE0F'}</span>
                <span style={S.riskText}>{t(`cropSummary.risk.${risk}`)}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ═══ E. SIMPLE ECONOMICS ═══ */}
        <Section icon={'\uD83D\uDCC8'} title={t('cropSummary.economics')}>
          <div style={S.econGrid}>
            <EconRow label={t('cropSummary.costLevel')} level={cp.costLevel} t={t} />
            <EconRow label={t('cropSummary.laborLevel')} level={cp.effortLevel} t={t} />
            <EconRow label={t('cropSummary.marketPotential')} level={cp.marketPotential} t={t} />
          </div>
        </Section>

        {/* ═══ F. WHY THIS CROP FITS YOU ═══ */}
        {crop.fitReasons && crop.fitReasons.length > 0 && (
          <Section icon={'\u2705'} title={t('cropSummary.whyFits')}>
            <div style={S.fitList}>
              {crop.fitReasons.map((key, i) => (
                <div key={i} style={S.fitRow}>
                  <span style={S.fitCheck}>{'\u2714\uFE0F'}</span>
                  <span style={S.fitText}>{t(key)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Error */}
        {error && <div style={S.errorBox}>{error}</div>}

        {/* ═══ G. START CTA ═══ */}
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          style={{
            ...S.startBtn,
            ...(starting ? S.startBtnDisabled : {}),
          }}
        >
          {starting ? t('cropSummary.starting') : t('cropSummary.startPlan')}
        </button>

        <p style={S.startHint}>{t('cropSummary.startHint')}</p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>
        <span style={S.sectionIcon}>{icon}</span>
        <span style={S.sectionTitle}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function EconRow({ label, level, t }) {
  return (
    <div style={S.econRow}>
      <span style={S.econLabel}>{label}</span>
      <span style={{ ...S.econValue, color: LEVEL_COLORS[level] }}>
        {t(`cropFit.level.${level}`)}
      </span>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '0 0 3rem',
  },
  container: {
    maxWidth: '28rem',
    margin: '0 auto',
    padding: '1rem 1rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  backBtn: {
    background: 'none', border: 'none', color: '#9FB3C8',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    padding: '0.25rem 0', alignSelf: 'flex-start',
    WebkitTapHighlightColor: 'transparent',
  },

  // ─── Overview card ──────────
  overviewCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '0.5rem', padding: '1.5rem',
    borderRadius: '22px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  overviewIcon: { fontSize: '3rem' },
  cropName: {
    fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#EAF2FF',
  },
  diffBadge: {
    fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.04em', padding: '0.25rem 0.75rem', borderRadius: '999px',
  },
  overviewStats: {
    display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap',
    justifyContent: 'center',
  },
  oStat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem',
  },
  oStatIcon: { fontSize: '1rem' },
  oStatLabel: { fontSize: '0.625rem', fontWeight: 600, color: '#6F8299', textTransform: 'uppercase' },
  oStatValue: { fontSize: '0.8125rem', fontWeight: 700, color: '#EAF2FF' },

  // ─── Section ────────────────
  section: {
    borderRadius: '18px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1rem 1.125rem',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    marginBottom: '0.625rem',
  },
  sectionIcon: { fontSize: '1rem' },
  sectionTitle: {
    fontSize: '0.8125rem', fontWeight: 700, color: '#9FB3C8',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },

  // ─── Stages ─────────────────
  stageList: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  stageRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  stageNum: {
    width: '20px', height: '20px', borderRadius: '50%',
    background: 'rgba(34,197,94,0.12)', color: '#22C55E',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.625rem', fontWeight: 800, flexShrink: 0,
  },
  stageIcon: { fontSize: '0.875rem', flexShrink: 0 },
  stageText: { fontSize: '0.875rem', fontWeight: 600, color: '#EAF2FF' },

  // ─── Needs ──────────────────
  needsGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  needChip: {
    display: 'flex', alignItems: 'center', gap: '0.25rem',
    padding: '0.375rem 0.625rem', borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    fontSize: '0.8125rem', fontWeight: 600, color: '#9FB3C8',
  },

  // ─── Risks ──────────────────
  riskList: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  riskRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  riskIcon: { fontSize: '0.875rem', flexShrink: 0 },
  riskText: { fontSize: '0.875rem', fontWeight: 600, color: '#FCA5A5' },

  // ─── Economics ──────────────
  econGrid: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  econRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  econLabel: { fontSize: '0.8125rem', color: '#9FB3C8', fontWeight: 600 },
  econValue: { fontSize: '0.8125rem', fontWeight: 700 },

  // ─── Fit reasons ────────────
  fitList: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  fitRow: { display: 'flex', alignItems: 'center', gap: '0.375rem' },
  fitCheck: { fontSize: '0.75rem', flexShrink: 0 },
  fitText: { fontSize: '0.8125rem', fontWeight: 600, color: '#22C55E' },

  // ─── Start CTA ──────────────
  errorBox: {
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.14)',
    borderRadius: '14px', padding: '0.75rem 1rem',
    color: '#FCA5A5', fontSize: '0.875rem', textAlign: 'center',
  },
  startBtn: {
    width: '100%', padding: '1rem',
    borderRadius: '16px', background: '#22C55E',
    color: '#fff', border: 'none',
    fontSize: '1.0625rem', fontWeight: 800,
    cursor: 'pointer', minHeight: '56px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    marginTop: '0.5rem',
    WebkitTapHighlightColor: 'transparent',
  },
  startBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  startHint: {
    fontSize: '0.75rem', color: '#6F8299', textAlign: 'center',
    marginTop: '0.25rem',
  },
};
