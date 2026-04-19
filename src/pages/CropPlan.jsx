/**
 * CropPlan — plan view for a single crop the farmer chose from the
 * recommendations screen.
 *
 * Navigated to via /crop-plan with route state:
 *   { crop: <recommendation object>, location: { state, displayRegion } }
 *
 * Renders:
 *   - why this crop
 *   - planting window
 *   - risk level
 *   - what to do now (action engine's doThisNow)
 *   - weekly task plan (weeklyGuide)
 *   - full action steps
 *
 * Falls back to the recommendation picker when navigated to directly.
 */
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';

const RISK_COLOR = {
  low:    '#22C55E',
  medium: '#F59E0B',
  high:   '#EF4444',
};

const TIMING_COLOR = {
  plant_now:  '#22C55E',
  plant_soon: '#F59E0B',
  wait:       '#9FB3C8',
  too_late:   '#EF4444',
  unknown:    '#9FB3C8',
};

function monthRange(win) {
  if (!win) return '';
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mo[(win.startMonth||1)-1]}–${mo[(win.endMonth||1)-1]}`;
}

export default function CropPlan() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const state = location.state;
  if (!state?.crop) return <Navigate to="/crop-fit/us" replace />;
  const { crop, location: loc } = state;

  const timing = crop.timing?.recommendation || 'unknown';
  const timingColor = TIMING_COLOR[timing] || TIMING_COLOR.unknown;
  const riskColor = RISK_COLOR[crop.riskLevel] || RISK_COLOR.low;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
          {'\u2190'} {t('common.back')}
        </button>

        <h1 style={S.title}>{crop.name}</h1>
        {loc && (
          <p style={S.subtitle}>{loc.state}, USA • {loc.displayRegionLabel || loc.displayRegion}</p>
        )}

        {/* ─── Headline chips ──────────────────────────── */}
        <div style={S.chipRow}>
          <span style={{ ...S.chip, color: timingColor, borderColor: timingColor }}>
            {t(`usRec.timing.${timing}`)}
          </span>
          <span style={{ ...S.chip, color: riskColor, borderColor: riskColor }}>
            {t('usRec.riskLevel')}: {t(`usRec.risk.${crop.riskLevel || 'low'}`)}
          </span>
          <span style={S.scoreChip}>{t('usRec.score')}: {crop.score}</span>
        </div>

        {/* ─── What to do now ──────────────────────────── */}
        {crop.doThisNow && (
          <section style={S.doNow}>
            <div style={S.doNowLabel}>{t('usRec.doThisNow')}</div>
            <div style={S.doNowText}>{crop.doThisNow}</div>
            {crop.nextAction && (
              <div style={S.nextLine}>
                <span style={S.nextLineLabel}>{t('usRec.nextStep')}:</span> {crop.nextAction}
              </div>
            )}
          </section>
        )}

        {/* ─── Why this crop ───────────────────────────── */}
        {crop.reasons?.length > 0 && (
          <Section title={t('usRec.whyThisCrop')} accent="#22C55E">
            <ul style={S.list}>
              {crop.reasons.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Section>
        )}

        {/* ─── Planting + harvest window ───────────────── */}
        <Section title={t('plan.windows')} accent="#0EA5E9">
          <div style={S.windowRow}>
            <div>
              <div style={S.windowLabel}>{t('usRec.plant')}</div>
              <div style={S.windowValue}>{monthRange(crop.plantingWindow)}</div>
            </div>
            <div>
              <div style={S.windowLabel}>{t('usRec.harvest')}</div>
              <div style={S.windowValue}>{monthRange(crop.harvestWindow)}</div>
            </div>
            <div>
              <div style={S.windowLabel}>{t('plan.duration')}</div>
              <div style={S.windowValue}>
                {crop.growthWeeksMin}–{crop.growthWeeksMax} {t('usRec.weeks')}
              </div>
            </div>
          </div>
        </Section>

        {/* ─── Risk breakdown ─────────────────────────── */}
        {crop.risks && (
          <Section title={t('plan.riskBreakdown')} accent={riskColor}>
            <div style={S.riskGrid}>
              <RiskTile label={t('plan.frost')} level={crop.risks.frostRisk} t={t} />
              <RiskTile label={t('plan.heat')} level={crop.risks.heatRisk} t={t} />
              <RiskTile label={t('plan.water')} level={crop.risks.waterStressRisk} t={t} />
            </div>
            {crop.riskNotes?.length > 0 && (
              <ul style={{ ...S.list, marginTop: '0.75rem' }}>
                {crop.riskNotes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </Section>
        )}

        {/* ─── Weekly plan ────────────────────────────── */}
        {crop.weeklyGuide?.length > 0 && (
          <Section title={t('plan.weeklyPlan')} accent="#A78BFA">
            <ol style={S.weekList}>
              {crop.weeklyGuide.map((w, i) => (
                <li key={i} style={S.weekItem}>
                  <span style={S.weekNumber}>Wk {i + 1}</span>
                  <span>{w}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* ─── Action steps ───────────────────────────── */}
        {crop.actionSteps?.length > 0 && (
          <Section title={t('usRec.actionSteps')} accent="#22C55E">
            <ol style={S.actionList}>
              {crop.actionSteps.map((step, i) => (
                <li key={i} style={S.actionItem}>
                  <div style={S.actionLabel}>{step.label}</div>
                  {step.detail && <div style={S.actionDetail}>{step.detail}</div>}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* ─── CTA ────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => navigate('/progress')}
          style={S.cta}
        >
          {t('plan.startTracking')}
        </button>
      </div>
    </div>
  );
}

function Section({ title, accent, children }) {
  return (
    <section style={S.section}>
      <h2 style={{ ...S.sectionTitle, color: accent }}>{title}</h2>
      {children}
    </section>
  );
}

function RiskTile({ label, level, t }) {
  const color = RISK_COLOR[level] || RISK_COLOR.low;
  return (
    <div style={{ ...S.riskTile, borderColor: color }}>
      <div style={S.riskTileLabel}>{label}</div>
      <div style={{ ...S.riskTileValue, color }}>{t(`usRec.risk.${level || 'low'}`)}</div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF' },
  backBtn: { background: 'none', border: 'none', color: '#9FB3C8', fontSize: '0.9375rem', padding: '0.5rem 0', cursor: 'pointer' },
  title: { fontSize: '1.75rem', fontWeight: 700, margin: '0.5rem 0 0.25rem' },
  subtitle: { fontSize: '0.9375rem', color: '#9FB3C8', margin: '0 0 1rem' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' },
  chip: {
    padding: '0.375rem 0.75rem', borderRadius: '999px',
    fontSize: '0.8125rem', fontWeight: 700,
    border: '1px solid',
    background: 'rgba(255,255,255,0.03)',
  },
  scoreChip: {
    padding: '0.375rem 0.75rem', borderRadius: '999px',
    fontSize: '0.8125rem', fontWeight: 700,
    color: '#22C55E', background: 'rgba(34,197,94,0.10)',
  },
  doNow: {
    padding: '1rem',
    borderRadius: '16px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    marginBottom: '1rem',
  },
  doNowLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#22C55E',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: '0.25rem',
  },
  doNowText: { fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1.35 },
  nextLine: {
    marginTop: '0.625rem', fontSize: '0.875rem', color: '#9FB3C8', lineHeight: 1.45,
  },
  nextLineLabel: { color: '#0EA5E9', fontWeight: 700 },
  section: {
    padding: '1rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '0.875rem',
  },
  sectionTitle: { fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.5rem' },
  list: { margin: 0, paddingLeft: '1.125rem', fontSize: '0.875rem', lineHeight: 1.5 },
  windowRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' },
  windowLabel: { fontSize: '0.6875rem', color: '#6F8299', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.125rem' },
  windowValue: { fontSize: '0.9375rem', fontWeight: 700 },
  riskGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' },
  riskTile: {
    padding: '0.625rem',
    borderRadius: '12px',
    border: '1px solid',
    background: 'rgba(255,255,255,0.04)',
    textAlign: 'center',
  },
  riskTileLabel: { fontSize: '0.6875rem', color: '#9FB3C8', marginBottom: '0.125rem' },
  riskTileValue: { fontSize: '0.9375rem', fontWeight: 700 },
  weekList: { margin: 0, paddingLeft: 0, listStyle: 'none' },
  weekItem: {
    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: '0.875rem',
  },
  weekNumber: {
    flexShrink: 0, minWidth: '3rem',
    fontSize: '0.75rem', fontWeight: 700, color: '#A78BFA',
  },
  actionList: { margin: 0, paddingLeft: '1.125rem' },
  actionItem: { fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '0.5rem' },
  actionLabel: { fontWeight: 600 },
  actionDetail: { color: '#9FB3C8', fontSize: '0.8125rem' },
  cta: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '52px',
    marginTop: '1rem',
  },
};
