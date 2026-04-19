/**
 * FirstLaunchConfirm — on first app open, confirm language + country
 * + U.S. state (when the country is US) before the farmer interacts
 * with anything else.
 *
 * Data flow:
 *   - initial values seeded from languageResolver / regionResolver
 *   - a GPS attempt runs in the background to suggest a region
 *   - user confirms → confirmLanguage + confirmRegion write the
 *     manual slots; a `farroway:firstLaunchComplete` flag is set.
 *
 * The modal is intentionally minimal: language, country, state.
 * Nothing else. Farm details come later in the fuller onboarding
 * wizard that already exists in the app.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import {
  SUPPORTED_LANGUAGES, resolveLanguage, confirmLanguage, detectBrowserLanguage,
} from '../../lib/languageResolver.js';
import {
  resolveRegion, confirmRegion, detectRegionViaGps, recordGpsRegion,
} from '../../lib/regionResolver.js';

const FIRST_LAUNCH_KEY = 'farroway:firstLaunchComplete';

/** Visible language chip options — skips legacy hidden codes. */
const VISIBLE_LANGS = SUPPORTED_LANGUAGES.filter((l) => !l.hidden);

/** Small top-10 country list for the confirmation dropdown. */
const COUNTRIES = [
  ['US', 'United States'], ['GH', 'Ghana'], ['NG', 'Nigeria'],
  ['IN', 'India'], ['KE', 'Kenya'], ['TZ', 'Tanzania'],
  ['UG', 'Uganda'], ['ZA', 'South Africa'], ['SN', 'Senegal'],
  ['GB', 'United Kingdom'], ['OTHER', 'Other / international'],
];

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
  ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],
  ['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
  ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],
  ['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],
  ['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],
  ['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
];

export function isFirstLaunchComplete() {
  try { return localStorage.getItem(FIRST_LAUNCH_KEY) === '1'; }
  catch { return false; }
}

function markFirstLaunchComplete() {
  try { localStorage.setItem(FIRST_LAUNCH_KEY, '1'); } catch { /* ignore */ }
}

/**
 * Minimal reverse-geocoder stub — maps common locale heuristics to
 * a country. Real apps would call a mapping service; we only need
 * the happy path for US/GH/IN since those are the supported regions.
 */
async function stubGeocoder(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Very coarse — good enough to suggest "United States" vs "Other".
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) return { country: 'US' };
  if (lat >= 4.5 && lat <= 11.5 && lng >= -3.5 && lng <= 1.5) return { country: 'GH' };
  if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 97) return { country: 'IN' };
  return null;
}

export default function FirstLaunchConfirm({ onComplete, geocoder = stubGeocoder }) {
  const { t, setLang } = useTranslation();

  const initial = resolveRegion();
  const [lang, setLangState] = useState(resolveLanguage());
  const [country, setCountry] = useState(initial.country || '');
  const [stateCode, setStateCode] = useState(initial.stateCode || '');
  const [detecting, setDetecting] = useState(false);

  // Background GPS attempt. Stays silent on failure; never blocks the
  // user from confirming manually.
  useEffect(() => {
    if (country) return; // already have a region
    let cancelled = false;
    setDetecting(true);
    (async () => {
      const region = await detectRegionViaGps({ geocoder });
      if (cancelled) return;
      setDetecting(false);
      if (region?.country) {
        recordGpsRegion(region);
        setCountry((c) => c || region.country);
        if (region.stateCode) setStateCode((s) => s || region.stateCode);
      }
    })();
    return () => { cancelled = true; };
  }, [country, geocoder]);

  // If the browser locale is a supported one and the user hasn't
  // chosen yet, nudge the default language there.
  useEffect(() => {
    const browser = detectBrowserLanguage();
    if (browser && lang === 'en' && browser !== 'en') {
      setLangState(browser);
    }
    // intentionally runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickLang(code) {
    setLangState(code);
    setLang(code); // live-update UI as the farmer experiments
  }

  function handleConfirm() {
    if (!country) return;
    confirmLanguage(lang);
    confirmRegion({ country, stateCode: country === 'US' ? stateCode : null });
    markFirstLaunchComplete();
    onComplete?.({ lang, country, stateCode });
  }

  function handleSkip() {
    // Skipping is fine — we still set language manual slot so the UI
    // doesn't re-nag, but leave region unset so the resolver stays
    // "unknown" and prompts again later.
    confirmLanguage(lang);
    markFirstLaunchComplete();
    onComplete?.({ lang, country: null, stateCode: null, skipped: true });
  }

  return (
    <div style={S.overlay} role="dialog" aria-labelledby="firstlaunch-title">
      <div style={S.modal}>
        <h2 id="firstlaunch-title" style={S.title}>{t('firstLaunch.title')}</h2>
        <p style={S.subtitle}>{t('firstLaunch.subtitle')}</p>

        {/* Language chips */}
        <section style={S.section}>
          <div style={S.sectionLabel}>{t('firstLaunch.language')}</div>
          <div style={S.chipRow}>
            {VISIBLE_LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => pickLang(l.code)}
                style={{
                  ...S.chip,
                  ...(lang === l.code ? S.chipActive : null),
                }}
                data-testid={`firstlaunch-lang-${l.code}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>

        {/* Country */}
        <section style={S.section}>
          <div style={S.sectionLabel}>{t('firstLaunch.country')}</div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={S.select}
            data-testid="firstlaunch-country"
          >
            <option value="">{detecting ? t('firstLaunch.detecting') : '—'}</option>
            {COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </section>

        {/* U.S. state — only when country === US */}
        {country === 'US' && (
          <section style={S.section}>
            <div style={S.sectionLabel}>{t('firstLaunch.state')}</div>
            <select
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              style={S.select}
              data-testid="firstlaunch-state"
            >
              <option value="">—</option>
              {US_STATES.map(([code, label]) => (
                <option key={code} value={code}>{label} ({code})</option>
              ))}
            </select>
          </section>
        )}

        <div style={S.actions}>
          <button type="button" onClick={handleSkip} style={S.skip}>
            {t('firstLaunch.skip')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!country || (country === 'US' && !stateCode)}
            style={S.confirm}
            data-testid="firstlaunch-confirm"
          >
            {t('firstLaunch.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    maxWidth: '28rem', width: '100%',
    background: '#0B1D34', color: '#EAF2FF',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px',
    padding: '1.25rem',
    boxShadow: '0 18px 48px rgba(0,0,0,0.5)',
  },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 1rem', lineHeight: 1.5 },
  section: { marginBottom: '0.875rem' },
  sectionLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#9FB3C8',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem',
  },
  chipRow: { display: 'flex', gap: '0.375rem', flexWrap: 'wrap' },
  chip: {
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
  chipActive: {
    background: 'rgba(34,197,94,0.14)',
    borderColor: '#22C55E',
    color: '#22C55E',
  },
  select: {
    width: '100%', padding: '0.625rem',
    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#EAF2FF',
    fontSize: '0.9375rem', minHeight: '44px',
  },
  actions: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem' },
  skip: {
    flex: '0 0 auto', padding: '0.625rem 0.875rem', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: '#9FB3C8',
    fontWeight: 600, cursor: 'pointer', minHeight: '44px',
  },
  confirm: {
    flex: 1, padding: '0.75rem', borderRadius: '12px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px',
  },
};
