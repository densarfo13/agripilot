/**
 * USCropRecommendations — state-aware crop recommendation screen.
 *
 * Hits POST /api/v2/recommend/us via useUSRecommendations and
 * renders three buckets (bestMatch / alsoConsider / notRecommendedNow)
 * with a dynamic header ("Best Crops for Texas, USA") and crop cards
 * that show score, difficulty, water need, reasons, risk notes, and
 * badges (Beginner Friendly / Container Friendly / Strong Local
 * Market / Heat Tolerant / Frost Risk).
 *
 * Rendered at /crop-fit/us. Leaves the existing /crop-fit flow
 * untouched so Africa-region farmers keep their existing experience.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useUSRecommendations } from '../hooks/useUSRecommendations.js';
import USStateSelector from '../components/onboarding/USStateSelector.jsx';

const BADGE_META = {
  beginner_friendly:    { labelKey: 'usRec.badge.beginner',   color: '#22C55E' },
  container_friendly:   { labelKey: 'usRec.badge.container',  color: '#0EA5E9' },
  strong_local_market:  { labelKey: 'usRec.badge.market',     color: '#F59E0B' },
  heat_tolerant:        { labelKey: 'usRec.badge.heat',       color: '#EF4444' },
  frost_risk:           { labelKey: 'usRec.badge.frost',      color: '#94A3B8' },
  cool_season:          { labelKey: 'usRec.badge.cool',       color: '#38BDF8' },
  warm_season:          { labelKey: 'usRec.badge.warm',       color: '#F97316' },
  drought_tolerant:     { labelKey: 'usRec.badge.drought',    color: '#A3A36F' },
};

export default function USCropRecommendations() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, setState] = useState('');
  const [farmType, setFarmType] = useState('backyard');
  const [beginnerLevel, setBeginnerLevel] = useState('beginner');
  const [growingStyle, setGrowingStyle] = useState('container');
  const [purpose, setPurpose] = useState('home_food');

  const { loading, error, data } = useUSRecommendations({
    state,
    farmType,
    beginnerLevel,
    growingStyle: farmType === 'backyard' ? growingStyle : null,
    purpose: farmType === 'backyard' ? purpose : null,
    enabled: !!state,
  });

  const farmTypeLabelKey = farmType === 'backyard'
    ? 'usRec.header.backyard'
    : farmType === 'small_farm'
      ? 'usRec.header.smallFarm'
      : 'usRec.header.commercial';

  return (
    <div style={S.page}>
      <div style={S.container}>
        <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
          {'\u2190'} {t('common.back')}
        </button>

        <h1 style={S.title}>{t('usRec.title')}</h1>
        <p style={S.subtitle}>{t('usRec.subtitle')}</p>

        {/* Intake block */}
        <div style={S.form}>
          <USStateSelector value={state} onChange={setState} label={t('usRec.form.state')} />

          <SelectRow
            label={t('usRec.form.farmType')}
            value={farmType}
            onChange={setFarmType}
            options={[
              { value: 'backyard',   label: t('usRec.farmType.backyard') },
              { value: 'small_farm', label: t('usRec.farmType.smallFarm') },
              { value: 'commercial', label: t('usRec.farmType.commercial') },
            ]}
          />

          <SelectRow
            label={t('usRec.form.beginnerLevel')}
            value={beginnerLevel}
            onChange={setBeginnerLevel}
            options={[
              { value: 'beginner',     label: t('usRec.beginner.beginner') },
              { value: 'intermediate', label: t('usRec.beginner.intermediate') },
              { value: 'advanced',     label: t('usRec.beginner.advanced') },
            ]}
          />

          {farmType === 'backyard' && (
            <>
              <SelectRow
                label={t('usRec.form.growingStyle')}
                value={growingStyle}
                onChange={setGrowingStyle}
                options={[
                  { value: 'container',  label: t('usRec.style.container') },
                  { value: 'raised_bed', label: t('usRec.style.raisedBed') },
                  { value: 'in_ground',  label: t('usRec.style.inGround') },
                  { value: 'mixed',      label: t('usRec.style.mixed') },
                ]}
              />
              <SelectRow
                label={t('usRec.form.purpose')}
                value={purpose}
                onChange={setPurpose}
                options={[
                  { value: 'home_food',    label: t('usRec.purpose.homeFood') },
                  { value: 'sell_locally', label: t('usRec.purpose.sellLocally') },
                  { value: 'learning',     label: t('usRec.purpose.learning') },
                  { value: 'mixed',        label: t('usRec.purpose.mixed') },
                ]}
              />
            </>
          )}
        </div>

        {/* States */}
        {!state && <p style={S.hint}>{t('usRec.hint.chooseState')}</p>}
        {loading && <p style={S.hint}>{t('common.loading')}</p>}
        {error && !loading && <p style={S.error}>{t('usRec.errorLoad')}</p>}

        {data?.ok === false && <p style={S.error}>{t('usRec.errorLoad')}</p>}

        {/* Results */}
        {data?.location && (
          <>
            <h2 style={S.resultHeader}>
              {t(farmTypeLabelKey, { state: data.location.state })}
            </h2>
            <p style={S.regionPill}>{data.location.displayRegion}</p>

            <Bucket
              title={t('usRec.bucket.best')}
              crops={data.bestMatch}
              accent="#22C55E"
              t={t}
            />
            <Bucket
              title={t('usRec.bucket.alsoConsider')}
              crops={data.alsoConsider}
              accent="#F59E0B"
              t={t}
            />
            {data.notRecommendedNow?.length > 0 && (
              <Bucket
                title={t('usRec.bucket.avoid')}
                crops={data.notRecommendedNow}
                accent="#94A3B8"
                muted
                t={t}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SelectRow({ label, value, onChange, options }) {
  return (
    <label style={S.fieldRow}>
      <span style={S.fieldLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={S.select}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Bucket({ title, crops, accent, muted, t }) {
  if (!crops || crops.length === 0) return null;
  return (
    <section style={S.bucket}>
      <h3 style={{ ...S.bucketTitle, color: accent }}>{title}</h3>
      <div style={S.cardGrid}>
        {crops.map((c) => (
          <CropCard key={c.key || c.name} crop={c} muted={muted} t={t} />
        ))}
      </div>
    </section>
  );
}

function CropCard({ crop, muted, t }) {
  const badges = (crop.tags || []).filter((tag) => BADGE_META[tag]);
  return (
    <article style={{ ...S.card, ...(muted ? S.cardMuted : null) }}>
      <header style={S.cardHeader}>
        <h4 style={S.cardTitle}>{crop.name}</h4>
        <span style={S.score}>{crop.score}</span>
      </header>

      <div style={S.metaRow}>
        <span>{t(`usRec.diff.${crop.difficulty}`)}</span>
        <span>•</span>
        <span>{t(`usRec.water.${crop.waterNeed}`)}</span>
        <span>•</span>
        <span>{crop.growthWeeksMin}–{crop.growthWeeksMax} {t('usRec.weeks')}</span>
      </div>

      {badges.length > 0 && (
        <div style={S.badges}>
          {badges.map((tag) => (
            <span key={tag} style={{ ...S.badge, background: BADGE_META[tag].color }}>
              {t(BADGE_META[tag].labelKey)}
            </span>
          ))}
        </div>
      )}

      {crop.reasons?.length > 0 && (
        <div style={S.reasons}>
          <div style={S.reasonsLabel}>{t('usRec.whyThisCrop')}</div>
          <ul style={S.list}>
            {crop.reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {crop.riskNotes?.length > 0 && (
        <div style={S.risks}>
          <div style={S.risksLabel}>{t('usRec.riskNotes')}</div>
          <ul style={S.list}>
            {crop.riskNotes.slice(0, 2).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {crop.plantingWindow && (
        <div style={S.window}>
          <span>{t('usRec.plant')}: {monthRange(crop.plantingWindow)}</span>
          {crop.harvestWindow && (
            <span> • {t('usRec.harvest')}: {monthRange(crop.harvestWindow)}</span>
          )}
        </div>
      )}
    </article>
  );
}

function monthRange(win) {
  if (!win) return '';
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const start = mo[(win.startMonth || 1) - 1];
  const end   = mo[(win.endMonth || 1) - 1];
  return start === end ? start : `${start}–${end}`;
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF' },
  backBtn: { background: 'none', border: 'none', color: '#9FB3C8', fontSize: '0.9375rem', padding: '0.5rem 0', cursor: 'pointer' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0 0.25rem' },
  subtitle: { fontSize: '0.9375rem', color: '#9FB3C8', margin: '0 0 1.25rem', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' },
  fieldRow: { display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  fieldLabel: { fontSize: '0.75rem', color: '#6F8299', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  select: { width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem', minHeight: '48px' },
  hint: { color: '#9FB3C8', fontSize: '0.875rem' },
  error: { color: '#FCA5A5', fontSize: '0.875rem' },
  resultHeader: { fontSize: '1.25rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.25rem' },
  regionPill: { display: 'inline-block', padding: '0.25rem 0.625rem', fontSize: '0.75rem', background: 'rgba(34,197,94,0.12)', color: '#22C55E', borderRadius: '999px', marginBottom: '1rem' },
  bucket: { marginTop: '1.25rem' },
  bucketTitle: { fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem' },
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' },
  card: { padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.22)' },
  cardMuted: { opacity: 0.55 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  cardTitle: { fontSize: '1.0625rem', fontWeight: 700, margin: 0 },
  score: { fontSize: '1.25rem', fontWeight: 700, color: '#22C55E' },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8125rem', color: '#9FB3C8', marginBottom: '0.5rem' },
  badges: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' },
  badge: { padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600, color: '#0B1D34' },
  reasons: { marginTop: '0.5rem' },
  reasonsLabel: { fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, marginBottom: '0.25rem' },
  risks: { marginTop: '0.5rem' },
  risksLabel: { fontSize: '0.75rem', color: '#F59E0B', fontWeight: 600, marginBottom: '0.25rem' },
  list: { margin: 0, paddingLeft: '1.125rem', fontSize: '0.8125rem', color: '#EAF2FF', lineHeight: 1.45 },
  window: { marginTop: '0.625rem', fontSize: '0.75rem', color: '#6F8299' },
};
