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
  getRecommendations = null,   // (ctx) ⇒ Promise<[{ crop, label?, reason? }]>
  getCropLabel = (c) => c,
  onSelect = () => {},
  onContinue = null,
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

  const title    = resolve(t, 'fast_onboarding.recommendation.title',    'Best crops for your area');
  const subtitle = resolve(t, 'fast_onboarding.recommendation.subtitle',
    'Based on your location and climate');
  const empty    = resolve(t, 'fast_onboarding.recommendation.empty',
    'We\u2019re still learning about your region \u2014 here are common starter crops');
  const startWithTpl = resolve(t, 'fast_onboarding.recommendation.start_with', 'Start with {crop}');

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

      {loading && <p style={{ color: '#90a4ae' }}>…</p>}

      {!loading && crops.length === 0 && (
        <p style={{ color: '#546e7a', fontSize: 14 }}>{empty}</p>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        {crops.map((c) => {
          const id = c.crop || c.id;
          const label = c.label || getCropLabel(id, state.setup?.language);
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '14px 16px', borderRadius: 12,
                border: `2px solid ${active ? '#1b5e20' : '#e0e0e0'}`,
                background: active ? '#f1f8e9' : '#fff',
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, color: '#1b1b1b' }}>
                {label}
              </span>
              {c.reason && (
                <span style={{ fontSize: 13, color: '#546e7a' }}>{c.reason}</span>
              )}
            </button>
          );
        })}
      </div>

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
