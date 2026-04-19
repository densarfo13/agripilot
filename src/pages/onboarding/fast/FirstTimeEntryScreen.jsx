/**
 * FirstTimeEntryScreen — Screen 3. No fields. One CTA.
 * Exists specifically to set expectations + commit the user
 * to the "Find my best crop" action before showing options.
 */

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function FirstTimeEntryScreen({
  t = null, onContinue = null, className = '',
}) {
  const title    = resolve(t, 'fast_onboarding.first_time.title',
    'Let\u2019s start your first farm');
  const subtitle = resolve(t, 'fast_onboarding.first_time.subtitle',
    'We\u2019ll guide you step by step');
  const cta      = resolve(t, 'fast_onboarding.first_time.cta',
    'Find my best crop');

  return (
    <main
      className={`fast-first-time ${className}`.trim()}
      data-step="first_time_entry"
      style={wrap}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                     alignItems: 'center', justifyContent: 'center',
                     textAlign: 'center', gap: 16 }}>
        <div aria-hidden="true" style={{ fontSize: 44 }}>🌱</div>
        <h1 style={h1}>{title}</h1>
        <p  style={sub}>{subtitle}</p>
      </div>
      <button type="button" onClick={onContinue} style={ctaBtn}>{cta}</button>
    </main>
  );
}

const wrap = { maxWidth: 520, margin: '0 auto', minHeight: '100vh',
               padding: '32px 20px 32px', display: 'flex',
               flexDirection: 'column' };
const h1  = { margin: 0, fontSize: 26, fontWeight: 700, color: '#1b1b1b', lineHeight: 1.2 };
const sub = { margin: 0, color: '#546e7a', fontSize: 15, lineHeight: 1.4, maxWidth: 420 };
const ctaBtn = { padding: '14px 16px', borderRadius: 12, border: 0,
                 background: '#1b5e20', color: '#fff', fontWeight: 700,
                 fontSize: 16, cursor: 'pointer', marginTop: 24 };
