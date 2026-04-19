/**
 * IntroScreen — Screen 0. Shown exactly once per user.
 *
 * Rules (per spec):
 *   • no skip
 *   • no extra actions
 *   • no distractions
 *   • Continue → sets hasSeenIntro and navigates to Setup
 */

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function IntroScreen({
  t = null,
  onContinue = null,
  className = '',
}) {
  const title    = resolve(t, 'fast_onboarding.intro.title',    'Welcome to Farroway');
  const subtitle = resolve(t, 'fast_onboarding.intro.subtitle',
    'We\u2019ll guide you on what to do on your farm every day');
  const cta      = resolve(t, 'fast_onboarding.intro.cta', 'Continue');

  return (
    <main
      className={`fast-intro ${className}`.trim()}
      data-step="intro"
      style={wrap}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                     alignItems: 'center', justifyContent: 'center',
                     textAlign: 'center', gap: 18 }}>
        <div aria-hidden="true" style={logo}>F</div>
        <h1 style={h1}>{title}</h1>
        <p  style={sub}>{subtitle}</p>
      </div>
      <button type="button" onClick={onContinue} style={cta_}>{cta}</button>
    </main>
  );
}

const wrap = { maxWidth: 520, margin: '0 auto', minHeight: '100vh',
               padding: '32px 20px 32px', display: 'flex',
               flexDirection: 'column' };
const logo = { width: 72, height: 72, borderRadius: 18, background: '#1b5e20',
               color: '#fff', display: 'inline-flex', alignItems: 'center',
               justifyContent: 'center', fontSize: 32, fontWeight: 800 };
const h1  = { margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: '#1b1b1b' };
const sub = { margin: 0, fontSize: 16, color: '#546e7a', lineHeight: 1.4, maxWidth: 420 };
const cta_ = { padding: '14px 16px', borderRadius: 12, border: 0,
               background: '#1b5e20', color: '#fff', fontWeight: 700,
               fontSize: 16, cursor: 'pointer', marginTop: 24 };
