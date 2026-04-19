/**
 * WelcomePage — step 1. One-line promise + primary CTA +
 * language selector. No other questions.
 */

import OnboardingShell from '../../../components/onboarding/v2/OnboardingShell.jsx';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const LANGS = ['en', 'hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];

export default function WelcomePage({
  state = {},
  t = null,
  onNext = null,
  onChangeLanguage = null,
}) {
  const promise = resolve(t, 'onboardingV2.welcome.promise',
    'We tell you what to do on your farm every day.');
  const cta = resolve(t, 'onboardingV2.welcome.cta', 'Get started');
  const langLabel = resolve(t, 'onboardingV2.welcome.languageLabel', 'Language');

  return (
    <OnboardingShell
      step={ONBOARDING_STEPS.WELCOME}
      t={t}
      onNext={onNext}
      nextLabel={cta}
      hideProgress
      hideBack
    >
      <section
        className="welcome-hero"
        style={{
          textAlign: 'center', padding: '48px 8px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}
      >
        <div
          className="welcome-hero__logo"
          aria-hidden="true"
          style={{
            width: 64, height: 64, borderRadius: 16,
            background: '#1b5e20', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800,
          }}
        >
          F
        </div>
        <p
          className="welcome-hero__promise"
          style={{ fontSize: 20, lineHeight: 1.3, color: '#263238', margin: 0, maxWidth: 420 }}
        >
          {promise}
        </p>
      </section>

      <section
        className="welcome-lang"
        style={{ marginTop: 20 }}
      >
        <label
          style={{
            display: 'block', fontSize: 13, fontWeight: 600,
            color: '#546e7a', marginBottom: 6,
          }}
        >
          {langLabel}
        </label>
        <select
          value={state.language || 'en'}
          onChange={(e) => onChangeLanguage && onChangeLanguage(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #cfd8dc', fontSize: 15,
          }}
        >
          {LANGS.map((l) => (
            <option key={l} value={l}>{localeDisplayName(l)}</option>
          ))}
        </select>
      </section>
    </OnboardingShell>
  );
}

function localeDisplayName(l) {
  const names = {
    en: 'English', hi: 'हिन्दी', tw: 'Twi', es: 'Español',
    pt: 'Português', fr: 'Français', ar: 'العربية', sw: 'Kiswahili', id: 'Bahasa Indonesia',
  };
  return names[l] || l;
}
