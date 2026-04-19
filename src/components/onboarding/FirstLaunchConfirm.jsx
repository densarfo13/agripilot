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
import { logClientEvent, ONBOARDING_EVENT_TYPES } from '../../utils/analyticsClient.js';

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
  // `detectResult` drives the confirmation / failure block that
  // appears under the Detect my location button. Shape:
  //   { status: 'idle' | 'detecting' | 'ok' | 'failed',
  //     country?, stateCode?, countryLabel?, stateLabel? }
  const [detectResult, setDetectResult] = useState({ status: 'idle' });

  // Background GPS attempt is deliberately disabled now — the
  // trust-gap fix requires the user to confirm before we apply the
  // detected region to the farm-profile fields. The button path
  // below is the only way detected values reach country/stateCode.

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
    logClientEvent(ONBOARDING_EVENT_TYPES.LANGUAGE_SELECTED, { lang: code });
  }

  function handleCountryChange(e) {
    const next = e.target.value;
    setCountry(next);
    if (next) {
      logClientEvent(ONBOARDING_EVENT_TYPES.MANUAL_COUNTRY_SELECTED, { country: next });
    }
  }

  function handleConfirm() {
    if (!country) {
      logClientEvent(ONBOARDING_EVENT_TYPES.CONTINUE_BLOCKED_MISSING_COUNTRY, { lang });
      return;
    }
    confirmLanguage(lang);
    confirmRegion({ country, stateCode: country === 'US' ? stateCode : null });
    markFirstLaunchComplete();
    logClientEvent(ONBOARDING_EVENT_TYPES.COMPLETED, { lang, country, stateCode: stateCode || null });
    onComplete?.({ lang, country, stateCode });
  }

  /**
   * handleDetectLocation — explicit "Detect my location" button.
   *
   * TRUST-GAP FIX: we no longer apply the detected country/state
   * to the form on success. We only stage it in `detectResult` and
   * ask the user "Is this your farm location?". Nothing reaches the
   * manual slots until they tap "Yes, use this".
   *
   * The detectResult.status carries five values:
   *   idle | detecting | detected_success |
   *   detection_failed | permission_denied
   *
   * We infer permission_denied from geolocation's own error code
   * (1 === PERMISSION_DENIED); anything else (timeout / position
   * unavailable / geocoder fail) collapses to detection_failed.
   */
  async function handleDetectLocation() {
    logClientEvent(ONBOARDING_EVENT_TYPES.LOCATION_DETECT_CLICKED, {});
    setDetectResult({ status: 'detecting' });
    setDetecting(true);

    // Pre-flight: distinguish permission_denied before we even call
    // detectRegionViaGps (which collapses both paths to null). We do
    // this by directly calling navigator.geolocation ourselves first,
    // then delegating to detectRegionViaGps for the happy path.
    const hasGeo = typeof navigator !== 'undefined' && navigator.geolocation;
    if (!hasGeo) {
      setDetecting(false);
      setDetectResult({ status: 'detection_failed' });
      logClientEvent(ONBOARDING_EVENT_TYPES.LOCATION_DETECT_FAILED, { reason: 'unavailable' });
      return;
    }

    try {
      // Probe permission directly so we can show the right card.
      const coords = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 7000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(timer); resolve(p); },
          (err) => { clearTimeout(timer); reject(err); },
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 5 * 60 * 1000 },
        );
      });

      let region = null;
      if (typeof geocoder === 'function' && coords?.coords) {
        try {
          region = await geocoder(coords.coords.latitude, coords.coords.longitude);
        } catch { region = null; }
      }
      setDetecting(false);

      if (!region?.country) {
        setDetectResult({ status: 'detection_failed' });
        logClientEvent(ONBOARDING_EVENT_TYPES.LOCATION_DETECT_FAILED, { reason: 'no_country' });
        return;
      }

      const countryLabel = (COUNTRIES.find(([c]) => c === region.country) || [])[1] || region.country;
      const stateLabel = region.stateCode
        ? (US_STATES.find(([c]) => c === region.stateCode) || [])[1] || region.stateCode
        : null;
      // Stage only — DO NOT mutate country/stateCode here.
      setDetectResult({
        status: 'detected_success',
        country: region.country,
        stateCode: region.stateCode || null,
        countryLabel,
        stateLabel,
      });
      logClientEvent(ONBOARDING_EVENT_TYPES.LOCATION_DETECT_SUCCESS, {
        country: region.country, stateCode: region.stateCode || null,
      });
    } catch (err) {
      setDetecting(false);
      // code 1 === PERMISSION_DENIED per the Geolocation API spec.
      if (err && err.code === 1) {
        setDetectResult({ status: 'permission_denied' });
        logClientEvent(ONBOARDING_EVENT_TYPES.LOCATION_PERMISSION_DENIED, {});
      } else {
        setDetectResult({ status: 'detection_failed' });
        logClientEvent(ONBOARDING_EVENT_TYPES.LOCATION_DETECT_FAILED, { reason: 'error' });
      }
    }
  }

  /**
   * acceptDetected — the "Yes, use this" button. ONLY here do we
   * apply the detected region to the editable form fields. The
   * farmer can still correct them afterwards.
   */
  function acceptDetected() {
    const r = detectResult;
    if (r.status !== 'detected_success' || !r.country) return;
    recordGpsRegion({ country: r.country, stateCode: r.stateCode || null });
    setCountry(r.country);
    if (r.stateCode) setStateCode(r.stateCode);
    setDetectResult({ status: 'idle' }); // collapse the confirmation card
  }

  function rejectDetected() {
    setDetectResult({ status: 'idle' });
  }

  function clearDetected() {
    setDetectResult({ status: 'idle' });
    setCountry('');
    setStateCode('');
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
        <h2 id="firstlaunch-title" style={S.title}>{t('setup_title')}</h2>
        <p style={S.subtitle}>{t('setup_subtitle')}</p>

        {/* Language chips */}
        <section style={S.section}>
          <div style={S.sectionLabel}>{t('language')}</div>
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
          <div style={S.sectionLabel}>{t('country')}</div>
          <select
            value={country}
            onChange={handleCountryChange}
            style={S.select}
            data-testid="firstlaunch-country"
          >
            <option value="">{detecting ? t('detecting_location') : '—'}</option>
            {COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </section>

        {/* U.S. state — only when country === US */}
        {country === 'US' && (
          <section style={S.section}>
            <div style={S.sectionLabel}>{t('state')}</div>
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

        {/* Explicit "Detect my location" — secondary action.
            Never blocks Continue; shows a calm success or failure
            block so the user is never left guessing. */}
        <section style={S.section}>
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={detectResult.status === 'detecting'}
            style={S.detectBtn}
            data-testid="firstlaunch-detect"
          >
            {detectResult.status === 'detecting'
              ? t('detecting_location')
              : t('detect_location')}
          </button>

          {/* TRUST-GAP CONFIRMATION: detected values are staged but
              not applied until the farmer says yes. "Is this your
              farm location?" is the explicit ask. */}
          {detectResult.status === 'detected_success' && (
            <div style={S.detectOk} data-testid="firstlaunch-detect-ok">
              <strong>{t('location_detected')}</strong>
              <div style={S.detectInlineHint}>{t('setup.confirmFarmLocation')}</div>
              <div style={S.detectLine}>
                <span style={S.detectLabel}>{t('country_detected')}:</span>{' '}
                <span>{detectResult.countryLabel}</span>
              </div>
              {detectResult.stateLabel && (
                <div style={S.detectLine}>
                  <span style={S.detectLabel}>{t('state_detected')}:</span>{' '}
                  <span>{detectResult.stateLabel}</span>
                </div>
              )}
              <div style={S.detectActions}>
                <button
                  type="button"
                  onClick={acceptDetected}
                  style={S.detectAccept}
                  data-testid="firstlaunch-detect-accept"
                >
                  {t('use_detected_location')}
                </button>
                <button
                  type="button"
                  onClick={rejectDetected}
                  style={S.detectClear}
                  data-testid="firstlaunch-detect-reject"
                >
                  {t('choose_manually')}
                </button>
              </div>
            </div>
          )}

          {detectResult.status === 'detection_failed' && (
            <div style={S.detectFail} data-testid="firstlaunch-detect-failed">
              <strong>{t('location_detection_failed')}</strong>
              <div style={S.detectInlineHint}>{t('choose_manually')}</div>
            </div>
          )}

          {detectResult.status === 'permission_denied' && (
            <div style={S.detectFail} data-testid="firstlaunch-detect-denied">
              <strong>{t('setup.locationPermissionDenied')}</strong>
              <div style={S.detectInlineHint}>{t('choose_manually')}</div>
            </div>
          )}

          {typeof navigator !== 'undefined' && navigator.onLine === false && (
            <div style={S.offlineHint} data-testid="firstlaunch-offline">
              {t('setup.offlineHint')}
            </div>
          )}
        </section>

        <div style={S.actions}>
          <button type="button" onClick={handleSkip} style={S.skip}>
            {t('skip')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!country || (country === 'US' && !stateCode)}
            style={S.confirm}
            data-testid="firstlaunch-confirm"
          >
            {t('continue')}
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
  detectBtn: {
    width: '100%', padding: '0.625rem', borderRadius: '10px',
    border: '1px solid rgba(14,165,233,0.28)',
    background: 'rgba(14,165,233,0.08)', color: '#0EA5E9',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', minHeight: '40px',
  },
  detectOk: {
    marginTop: '0.5rem', padding: '0.625rem 0.75rem', borderRadius: '10px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.25)',
    color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.25rem',
  },
  detectFail: {
    marginTop: '0.5rem', padding: '0.625rem 0.75rem', borderRadius: '10px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.22)',
    color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.125rem',
  },
  detectLine: { fontSize: '0.8125rem', color: '#EAF2FF' },
  detectLabel: { color: '#9FB3C8', fontWeight: 600 },
  detectActions: {
    marginTop: '0.125rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem',
  },
  detectInlineHint: { fontSize: '0.75rem', color: '#9FB3C8' },
  detectClear: {
    padding: '0.375rem 0.75rem', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
  detectAccept: {
    padding: '0.375rem 0.75rem', borderRadius: '8px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
  offlineHint: {
    marginTop: '0.5rem', padding: '0.5rem 0.625rem', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.12)',
    color: '#9FB3C8', fontSize: '0.75rem',
  },
};
