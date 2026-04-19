/**
 * FarmerTypeScreen — Screen 2. One question, two options.
 * Stores user.farmerType and routes accordingly downstream.
 */

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function FarmerTypeScreen({
  state = {},
  t = null,
  onPatch = () => {},
  onContinue = null,
  className = '',
}) {
  const selected = state.farmerType;
  const title    = resolve(t, 'fast_onboarding.farmer_type.title',  'Have you farmed before?');
  const helper   = resolve(t, 'fast_onboarding.farmer_type.helper', 'We\u2019ll tailor the first step to you');
  const newLbl   = resolve(t, 'fast_onboarding.farmer_type.new',    'I\u2019m new to farming');
  const exisLbl  = resolve(t, 'fast_onboarding.farmer_type.existing', 'I already farm');
  const cta      = resolve(t, 'fast_onboarding.farmer_type.cta',    'Continue');

  const canAdvance = selected === 'new' || selected === 'existing';

  return (
    <main
      className={`fast-farmer-type ${className}`.trim()}
      data-step="farmer_type"
      style={wrap}
    >
      <h1 style={h1}>{title}</h1>
      <p style={helperStyle}>{helper}</p>

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {[
          { id: 'new',      emoji: '🌱', label: newLbl },
          { id: 'existing', emoji: '👩‍🌾', label: exisLbl },
        ].map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPatch({ farmerType: opt.id })}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px', borderRadius: 12,
                border: `2px solid ${active ? '#1b5e20' : '#e0e0e0'}`,
                background: active ? '#f1f8e9' : '#fff',
                fontSize: 16, fontWeight: 600, color: '#1b1b1b',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 24 }}>{opt.emoji}</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onContinue}
        disabled={!canAdvance}
        style={{
          ...ctaBtn,
          background: canAdvance ? '#1b5e20' : '#b0bec5',
          cursor:    canAdvance ? 'pointer' : 'not-allowed',
        }}
      >
        {cta}
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
