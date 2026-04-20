/**
 * CropRecommendationScreen — Screen 4. Shows 3–5 crop cards
 * picked by the caller-supplied resolver. Tapping one selects
 * + reveals the "Start with {crop}" CTA.
 *
 * Pure presentational — the recommender logic lives outside.
 */

import { useEffect, useState } from 'react';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

function interpolate(text, vars = {}) {
  if (!text) return text;
  return String(text).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k]));
}

export default function CropRecommendationScreen({
  state = {},
  t = null,
  // (ctx) ⇒ Promise<[{ crop, label?, reason?, confidence?,
  //                     plantingWindow?, note?, isGeneral? }]>
  getRecommendations = null,
  getCropLabel = (c) => c,
  onSelect = () => {},
  onContinue = null,
  onChangeLocation = null,       // tapping "Change country" goes back to setup
  className = '',
}) {
  const [loading, setLoading] = useState(true);
  const [crops, setCrops]     = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const out = typeof getRecommendations === 'function'
          ? await getRecommendations(state)
          : [];
        if (alive) setCrops(Array.isArray(out) ? out.slice(0, 5) : []);
      } catch {
        if (alive) setCrops([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Copy: farmer-type-aware (spec §4) ─────────────────
  const farmerType = state.farmerType || null;
  const isNew = farmerType === 'new';
  const title    = resolve(t, 'fast_onboarding.recommendation.title',
    'Recommended for your area');
  const subtitle = isNew
    ? resolve(t, 'fast_onboarding.recommendation.subtitle_new',
        'Here are crops that tend to do well where you are. Pick one to start \u2014 you can always change later.')
    : resolve(t, 'fast_onboarding.recommendation.subtitle',
        'Based on your location and climate');
  const empty    = resolve(t, 'fast_onboarding.recommendation.empty',
    'We\u2019re still learning about your region \u2014 here are common starter crops');
  const general  = resolve(t, 'fast_onboarding.recommendation.general',
    'Your country isn\u2019t fully mapped yet \u2014 these are general starter crops.');
  const startWithTpl = resolve(t, 'fast_onboarding.recommendation.start_with', 'Start with {crop}');
  const changeCtry   = resolve(t, 'fast_onboarding.recommendation.change_country', 'Change country');
  const windowLbl    = resolve(t, 'fast_onboarding.recommendation.planting_window', 'Best planting');
  const confLabels   = {
    high:   resolve(t, 'fast_onboarding.recommendation.fit.high',   'Great fit'),
    medium: resolve(t, 'fast_onboarding.recommendation.fit.medium', 'Good fit'),
    low:    resolve(t, 'fast_onboarding.recommendation.fit.low',    'Worth trying'),
  };
  const confColors = {
    high:   { fg: '#1b5e20', bg: '#e8f5e9' },
    medium: { fg: '#1565c0', bg: '#e3f2fd' },
    low:    { fg: '#78909c', bg: '#eceff1' },
  };
  const isGeneral = crops.length > 0 && crops.every((c) => c.isGeneral);

  // Planting-decision badges + copy (fallbacks match
  // plantingDecision.js and stay farmer-friendly).
  const decisionLabels = {
    good_to_plant:   resolve(t, 'planting.decision.good_to_plant',   'Good to plant now'),
    plant_soon:      resolve(t, 'planting.decision.plant_soon',      'Plant soon'),
    wait_monitor:    resolve(t, 'planting.decision.wait_monitor',    'Wait and monitor'),
    not_recommended: resolve(t, 'planting.decision.not_recommended', 'Not recommended now'),
    unsupported:     resolve(t, 'planting.decision.unsupported',     'Seasonal guidance unavailable'),
  };
  const nextStepLabels = {
    good_to_plant:   resolve(t, 'planting.next_step.good_to_plant',
      'Season is right where you are — start preparing your land.'),
    plant_soon:      resolve(t, 'planting.next_step.plant_soon',
      'Get ready — your planting window is coming up.'),
    wait_monitor:    resolve(t, 'planting.next_step.wait_monitor',
      'Hold off and watch the weather — check again in a few days.'),
    not_recommended: resolve(t, 'planting.next_step.not_recommended',
      'Outside the planting window — pick a different crop or wait for the next season.'),
    unsupported:     resolve(t, 'planting.next_step.unsupported',
      'We don\u2019t have seasonal rules for your region yet — ask local extension services.'),
  };
  const decisionColors = {
    good_to_plant:   { fg: '#1b5e20', bg: '#e8f5e9' },
    plant_soon:      { fg: '#1565c0', bg: '#e3f2fd' },
    wait_monitor:    { fg: '#b26a00', bg: '#fff3e0' },
    not_recommended: { fg: '#c62828', bg: '#ffebee' },
    unsupported:     { fg: '#546e7a', bg: '#eceff1' },
  };

  const selected = state.selectedCrop;
  const selectedLabel = selected
    ? getCropLabel(selected, state.setup?.language)
    : null;

  return (
    <main
      className={`fast-crop-rec ${className}`.trim()}
      data-step="recommendation"
      style={wrap}
    >
      <h1 style={h1}>{title}</h1>
      <p style={helperStyle}>{subtitle}</p>

      {!loading && isGeneral && (
        <p style={generalLine} data-testid="rec-general-note">{general}</p>
      )}

      {loading && <p style={{ color: '#90a4ae' }}>…</p>}

      {!loading && crops.length === 0 && (
        <p style={{ color: '#546e7a', fontSize: 14 }}>{empty}</p>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        {crops.map((c) => {
          const id = c.crop || c.id;
          const label = c.label || getCropLabel(id, state.setup?.language);
          const active = selected === id;
          const conf = c.confidence && confLabels[c.confidence] ? c.confidence : null;
          const badge = conf ? { label: confLabels[conf], color: confColors[conf] } : null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              data-testid={`rec-card-${id}`}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: '14px 16px', borderRadius: 12,
                border: `2px solid ${active ? '#1b5e20' : '#e0e0e0'}`,
                background: active ? '#f1f8e9' : '#fff',
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#1b1b1b' }}>
                  {label}
                </span>
                {badge && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700,
                    background: badge.color.bg, color: badge.color.fg,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {badge.label}
                  </span>
                )}
              </div>
              {c.reason && (
                <span style={{ fontSize: 13, color: '#546e7a', lineHeight: 1.4 }}>
                  {c.reason}
                </span>
              )}
              {c.plantingWindow && (
                <span style={{ fontSize: 12, color: '#263238', fontWeight: 600 }}>
                  {windowLbl}: <span style={{ fontWeight: 500 }}>{c.plantingWindow}</span>
                </span>
              )}
              {c.note && (
                <span style={{ fontSize: 12, color: '#78909c', fontStyle: 'italic',
                               lineHeight: 1.4 }}>
                  {c.note}
                </span>
              )}
              {c.decisionStatus && decisionLabels[c.decisionStatus] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4,
                              marginTop: 4 }}
                     data-testid={`rec-decision-${id}`}>
                  <span style={{
                    alignSelf: 'flex-start',
                    padding: '3px 8px', borderRadius: 8,
                    fontSize: 11, fontWeight: 700,
                    background: decisionColors[c.decisionStatus].bg,
                    color:      decisionColors[c.decisionStatus].fg,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {decisionLabels[c.decisionStatus]}
                  </span>
                  {nextStepLabels[c.decisionStatus] && (
                    <span style={{ fontSize: 12, color: '#37474f', lineHeight: 1.4 }}>
                      {nextStepLabels[c.decisionStatus]}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {typeof onChangeLocation === 'function' && (
        <button
          type="button"
          onClick={onChangeLocation}
          style={changeBtn}
          data-testid="rec-change-country"
        >
          {changeCtry}
        </button>
      )}

      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onContinue}
        disabled={!selected}
        style={{
          ...ctaBtn,
          background: selected ? '#1b5e20' : '#b0bec5',
          cursor:    selected ? 'pointer' : 'not-allowed',
        }}
      >
        {interpolate(startWithTpl, { crop: selectedLabel || '—' })}
      </button>
    </main>
  );
}

const wrap = { maxWidth: 520, margin: '0 auto', minHeight: '100vh',
               padding: '24px 20px 32px', display: 'flex',
               flexDirection: 'column', gap: 8 };
const h1 = { margin: 0, fontSize: 22, fontWeight: 700, color: '#1b1b1b', lineHeight: 1.25 };
const helperStyle = { margin: 0, color: '#546e7a', fontSize: 14, lineHeight: 1.4 };
const ctaBtn = { padding: '14px 16px', borderRadius: 12, border: 0,
                 color: '#fff', fontWeight: 700, fontSize: 16 };
const generalLine = {
  margin: '4px 0 0', padding: '8px 12px', borderRadius: 10,
  background: '#fff8e1', border: '1px solid #ffe082',
  color: '#8d6e63', fontSize: 13, lineHeight: 1.4,
};
const changeBtn = {
  marginTop: 8, padding: '10px 14px', borderRadius: 10,
  border: '1px solid #cfd8dc', background: '#fff',
  color: '#455a64', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};
