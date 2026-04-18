/**
 * OnboardingSteps — lightweight 5-step wizard for first-time farmers.
 *
 * Replaces the heavy form-first ProfileSetup with a tap-friendly,
 * low-literacy-friendly onboarding flow.
 *
 * Props:
 *   onComplete(formData) — called with collected data when farmer finishes
 *   onCancel()           — called when farmer exits early
 */
import { useState, useCallback } from 'react';
import { useTranslation } from '../i18n/index.js';

// ── Top 12 crops for icon-grid selection ──────────────────────
const TOP_CROPS = [
  { code: 'MAIZE',   icon: '\uD83C\uDF3D' },
  { code: 'RICE',    icon: '\uD83C\uDF3E' },
  { code: 'BEAN',    icon: '\uD83E\uDED8' },
  { code: 'COFFEE',  icon: '\u2615'       },
  { code: 'CASSAVA', icon: '\uD83E\uDD54' },
  { code: 'BANANA',  icon: '\uD83C\uDF4C' },
  { code: 'WHEAT',   icon: '\uD83C\uDF3E' },
  { code: 'SORGHUM', icon: '\uD83C\uDF3F' },
  { code: 'COCOA',   icon: '\uD83E\uDD65' },
  { code: 'TOMATO',  icon: '\uD83C\uDF45' },
  { code: 'POTATO',  icon: '\uD83E\uDD54' },
  { code: 'ONION',   icon: '\uD83E\uDDC5' },
];

const TOTAL_STEPS = 6;

// ── Gender & age options for optional demographics step ──────
const GENDER_OPTIONS = [
  { value: 'male',              icon: '\uD83D\uDC68\u200D\uD83C\uDF3E' },
  { value: 'female',            icon: '\uD83D\uDC69\u200D\uD83C\uDF3E' },
  { value: 'other',             icon: '\uD83E\uDDD1\u200D\uD83C\uDF3E' },
  { value: 'prefer_not_to_say', icon: '\u2014'                         },
];

const AGE_OPTIONS = [
  { value: 'under_25' },
  { value: '25_34'    },
  { value: '35_44'    },
  { value: '45_54'    },
  { value: '55_plus'  },
  { value: 'prefer_not_to_say' },
];

const FARM_SIZES = [
  { key: 'small',  acres: 1,  icon: '\uD83C\uDF31' },
  { key: 'medium', acres: 5,  icon: '\uD83C\uDF3E' },
  { key: 'large',  acres: 20, icon: '\uD83C\uDFDE\uFE0F' },
];

// ── Reverse-geocode via Nominatim ─────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const address = data.address || {};
    const locationName =
      address.city || address.town || address.village || address.county || data.display_name || '';
    const country = address.country || '';
    return { locationName, country };
  } catch {
    return { locationName: '', country: '' };
  }
}

export default function OnboardingSteps({ onComplete, onCancel }) {
  const { t } = useTranslation();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    experienceLevel: '',
    locationName: '',
    gpsLat: null,
    gpsLng: null,
    country: '',
    crop: '',
    customCrop: '',
    farmSizeCategory: '',
    farmSizeAcres: 0,
    farmName: '',
    gender: '',
    ageGroup: '',
  });

  // Location-detection state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);

  // ── helpers ───────────────────────────────────────────────
  const update = useCallback((patch) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = () => {
    const out = { ...formData };
    // If "OTHER" crop, use the custom text
    if (out.crop === 'OTHER' && out.customCrop) {
      out.crop = out.customCrop;
    }
    delete out.customCrop;
    onComplete(out);
  };

  // ── GPS ───────────────────────────────────────────────────
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGpsFailed(true);
      return;
    }
    setGpsLoading(true);
    setGpsFailed(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const geo = await reverseGeocode(latitude, longitude);
        update({
          gpsLat: latitude,
          gpsLng: longitude,
          locationName: geo.locationName,
          country: geo.country,
        });
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        setGpsFailed(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ── Step dots ─────────────────────────────────────────────
  const StepDots = () => (
    <div style={S.dotsRow}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          style={{
            ...S.dot,
            background: i + 1 === step ? '#22C55E' : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  );

  // ── Step 1 — Experience ───────────────────────────────────
  const renderStep1 = () => (
    <div style={S.stepBody}>
      <h2 style={S.heading}>{t('onboarding.newToFarming')}</h2>
      <div style={S.choiceCol}>
        <button
          style={{
            ...S.bigBtn,
            borderColor: formData.experienceLevel === 'new' ? '#22C55E' : 'rgba(255,255,255,0.1)',
          }}
          onClick={() => { update({ experienceLevel: 'new' }); next(); }}
        >
          <span style={S.bigBtnIcon}>{'\uD83C\uDF31'}</span>
          <span style={S.bigBtnLabel}>{t('onboarding.yesNew')}</span>
        </button>
        <button
          style={{
            ...S.bigBtn,
            borderColor: formData.experienceLevel === 'experienced' ? '#22C55E' : 'rgba(255,255,255,0.1)',
          }}
          onClick={() => { update({ experienceLevel: 'experienced' }); next(); }}
        >
          <span style={S.bigBtnIcon}>{'\uD83D\uDCAA'}</span>
          <span style={S.bigBtnLabel}>{t('onboarding.haveExperience')}</span>
        </button>
      </div>
    </div>
  );

  // ── Step 2 — Location ─────────────────────────────────────
  const renderStep2 = () => (
    <div style={S.stepBody}>
      <h2 style={S.heading}>{t('onboarding.whereIsFarm')}</h2>

      {!formData.gpsLat && !gpsFailed && (
        <button
          style={{ ...S.bigBtn, borderColor: '#22C55E' }}
          onClick={detectLocation}
          disabled={gpsLoading}
        >
          <span style={S.bigBtnIcon}>{gpsLoading ? '\u23F3' : '\uD83D\uDCCD'}</span>
          <span style={S.bigBtnLabel}>
            {gpsLoading ? t('onboarding.detecting') : t('onboarding.useMyLocation')}
          </span>
        </button>
      )}

      {formData.gpsLat && (
        <div style={S.detectedBox}>
          <span style={{ fontSize: '1.2rem' }}>{'\u2705'}</span>
          <span style={S.detectedText}>{formData.locationName || `${formData.gpsLat.toFixed(3)}, ${formData.gpsLng.toFixed(3)}`}</span>
        </div>
      )}

      {(gpsFailed || formData.gpsLat) && (
        <div style={{ marginTop: '1rem' }}>
          {gpsFailed && (
            <p style={S.hint}>{t('onboarding.gpsFailed')}</p>
          )}
          <input
            type="text"
            value={formData.locationName}
            onChange={(e) => update({ locationName: e.target.value })}
            placeholder={t('onboarding.locationPlaceholder')}
            style={S.textInput}
          />
        </div>
      )}

      <button
        style={{ ...S.primaryBtn, marginTop: '1.5rem' }}
        onClick={next}
        disabled={!formData.locationName && !formData.gpsLat}
      >
        {t('onboarding.next')}
      </button>
    </div>
  );

  // ── Step 3 — Crop ─────────────────────────────────────────
  const renderStep3 = () => (
    <div style={S.stepBody}>
      <h2 style={S.heading}>{t('onboarding.whatGrowing')}</h2>
      <div style={S.cropGrid}>
        {TOP_CROPS.map((c) => (
          <button
            key={c.code}
            style={{
              ...S.cropTile,
              borderColor: formData.crop === c.code ? '#22C55E' : 'rgba(255,255,255,0.08)',
              background: formData.crop === c.code ? 'rgba(34,197,94,0.12)' : '#1B2330',
            }}
            onClick={() => update({ crop: c.code })}
          >
            <span style={S.cropIcon}>{c.icon}</span>
            <span style={S.cropLabel}>{t(`crop.${c.code}`)}</span>
          </button>
        ))}
        {/* Other option */}
        <button
          style={{
            ...S.cropTile,
            borderColor: formData.crop === 'OTHER' ? '#22C55E' : 'rgba(255,255,255,0.08)',
            background: formData.crop === 'OTHER' ? 'rgba(34,197,94,0.12)' : '#1B2330',
          }}
          onClick={() => update({ crop: 'OTHER' })}
        >
          <span style={S.cropIcon}>{'\u2795'}</span>
          <span style={S.cropLabel}>{t('onboarding.other')}</span>
        </button>
      </div>

      {formData.crop === 'OTHER' && (
        <input
          type="text"
          value={formData.customCrop}
          onChange={(e) => update({ customCrop: e.target.value })}
          placeholder={t('onboarding.typeCrop')}
          style={{ ...S.textInput, marginTop: '0.75rem' }}
        />
      )}

      <button
        style={{ ...S.primaryBtn, marginTop: '1.25rem' }}
        onClick={next}
        disabled={!formData.crop || (formData.crop === 'OTHER' && !formData.customCrop)}
      >
        {t('onboarding.next')}
      </button>
    </div>
  );

  // ── Step 4 — Farm Size ────────────────────────────────────
  const renderStep4 = () => (
    <div style={S.stepBody}>
      <h2 style={S.heading}>{t('onboarding.howBig')}</h2>
      <div style={S.sizeRow}>
        {FARM_SIZES.map((fs) => (
          <button
            key={fs.key}
            style={{
              ...S.sizeCard,
              borderColor: formData.farmSizeCategory === fs.key ? '#22C55E' : 'rgba(255,255,255,0.08)',
              background: formData.farmSizeCategory === fs.key ? 'rgba(34,197,94,0.12)' : '#1B2330',
            }}
            onClick={() => update({ farmSizeCategory: fs.key, farmSizeAcres: fs.acres })}
          >
            <span style={S.sizeIcon}>{fs.icon}</span>
            <span style={S.sizeLabel}>{t(`onboarding.size.${fs.key}`)}</span>
            <span style={S.sizeRange}>{t(`onboarding.sizeRange.${fs.key}`)}</span>
          </button>
        ))}
      </div>
      <button
        style={{ ...S.primaryBtn, marginTop: '1.5rem' }}
        onClick={next}
        disabled={!formData.farmSizeCategory}
      >
        {t('onboarding.next')}
      </button>
    </div>
  );

  // ── Step 5 — Farm Name ────────────────────────────────────
  const renderStep5 = () => (
    <div style={S.stepBody}>
      <h2 style={S.heading}>{t('onboarding.nameFarm')}</h2>
      <input
        type="text"
        value={formData.farmName}
        onChange={(e) => update({ farmName: e.target.value })}
        placeholder={t('onboarding.farmNamePlaceholder')}
        style={S.textInput}
      />
      <button
        style={{ ...S.primaryBtn, marginTop: '1.5rem' }}
        onClick={next}
        disabled={!formData.farmName.trim()}
      >
        {t('onboarding.next')}
      </button>
    </div>
  );

  // ── Step 6 — Optional Demographics ────────────────────────
  const renderStep6 = () => (
    <div style={S.stepBody}>
      <h2 style={S.heading}>{t('onboarding.demographics.title')}</h2>
      <p style={S.demoSubtitle}>{t('onboarding.demographics.subtitle')}</p>

      {/* Gender */}
      <div style={S.demoSection}>
        <div style={S.demoLabel}>{t('onboarding.demographics.gender')}</div>
        <div style={S.demoRow}>
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g.value}
              style={{
                ...S.demoChip,
                borderColor: formData.gender === g.value ? '#22C55E' : 'rgba(255,255,255,0.1)',
                background: formData.gender === g.value ? 'rgba(34,197,94,0.12)' : '#1B2330',
              }}
              onClick={() => update({ gender: formData.gender === g.value ? '' : g.value })}
            >
              <span style={S.demoChipIcon}>{g.icon}</span>
              <span style={S.demoChipLabel}>{t(`gender.${g.value === 'prefer_not_to_say' ? 'preferNotToSay' : g.value}`)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Age range */}
      <div style={S.demoSection}>
        <div style={S.demoLabel}>{t('onboarding.demographics.ageRange')}</div>
        <div style={S.demoRow}>
          {AGE_OPTIONS.map((a) => (
            <button
              key={a.value}
              style={{
                ...S.ageChip,
                borderColor: formData.ageGroup === a.value ? '#22C55E' : 'rgba(255,255,255,0.1)',
                background: formData.ageGroup === a.value ? 'rgba(34,197,94,0.12)' : '#1B2330',
              }}
              onClick={() => update({ ageGroup: formData.ageGroup === a.value ? '' : a.value })}
            >
              {t(`age.${a.value}`)}
            </button>
          ))}
        </div>
      </div>

      <button
        style={{ ...S.primaryBtn, marginTop: '1.5rem' }}
        onClick={handleSubmit}
      >
        {t('onboarding.startFarming')}
      </button>
      <button
        style={S.skipBtn}
        onClick={handleSubmit}
      >
        {t('onboarding.demographics.skip')}
      </button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────
  const stepRenderers = [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6];

  return (
    <div style={S.container}>
      {/* Header: back + dots + cancel */}
      <div style={S.header}>
        {step > 1 ? (
          <button style={S.backBtn} onClick={back} aria-label={t('onboarding.back')}>
            {'\u2190'}
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
        <StepDots />
        {onCancel ? (
          <button style={S.cancelBtn} onClick={onCancel} aria-label={t('onboarding.cancel')}>
            {'\u2715'}
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </div>

      {/* Current step */}
      {stepRenderers[step]()}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const S = {
  container: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  // ── Header ──
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.4rem',
    cursor: 'pointer',
    padding: '0.5rem',
    minWidth: 44,
    minHeight: 44,
    WebkitTapHighlightColor: 'transparent',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.5rem',
    minWidth: 44,
    minHeight: 44,
    WebkitTapHighlightColor: 'transparent',
  },

  // ── Step dots ──
  dotsRow: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center',
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    transition: 'background 0.2s',
  },

  // ── Step body ──
  stepBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '1.5rem',
    lineHeight: 1.3,
  },

  // ── Big tap buttons (Step 1, Step 2 GPS) ──
  choiceCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    maxWidth: 360,
  },
  bigBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderRadius: '14px',
    background: '#1B2330',
    border: '2px solid rgba(255,255,255,0.1)',
    color: '#fff',
    cursor: 'pointer',
    minHeight: 56,
    width: '100%',
    maxWidth: 360,
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  bigBtnIcon: {
    fontSize: '1.6rem',
    flexShrink: 0,
  },
  bigBtnLabel: {
    fontSize: '1.05rem',
    fontWeight: 600,
    textAlign: 'left',
  },

  // ── Detected location box ──
  detectedBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    width: '100%',
    maxWidth: 360,
    marginTop: '0.75rem',
  },
  detectedText: {
    fontSize: '0.95rem',
    color: 'rgba(255,255,255,0.9)',
  },
  hint: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '0.5rem',
    textAlign: 'center',
  },

  // ── Text input ──
  textInput: {
    width: '100%',
    maxWidth: 360,
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: '#1B2330',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  },

  // ── Primary action button ──
  primaryBtn: {
    width: '100%',
    maxWidth: 360,
    padding: '0.95rem 1rem',
    borderRadius: '12px',
    background: '#22C55E',
    border: 'none',
    color: '#fff',
    fontSize: '1.05rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 56,
    WebkitTapHighlightColor: 'transparent',
    transition: 'opacity 0.15s',
  },

  // ── Crop grid (Step 3) ──
  cropGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.5rem',
    width: '100%',
    maxWidth: 360,
  },
  cropTile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    padding: '0.7rem 0.25rem',
    borderRadius: '12px',
    border: '2px solid rgba(255,255,255,0.08)',
    color: '#fff',
    cursor: 'pointer',
    minHeight: 56,
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  cropIcon: {
    fontSize: '1.5rem',
  },
  cropLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.2,
  },

  // ── Farm size cards (Step 4) ──
  sizeRow: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
    maxWidth: 360,
    justifyContent: 'center',
  },
  sizeCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    padding: '1rem 0.5rem',
    borderRadius: '14px',
    border: '2px solid rgba(255,255,255,0.08)',
    color: '#fff',
    cursor: 'pointer',
    minHeight: 56,
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  sizeIcon: {
    fontSize: '1.6rem',
  },
  sizeLabel: {
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  sizeRange: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.5)',
  },

  // ── Demographics step (Step 6) ──
  demoSubtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: '-0.75rem',
    marginBottom: '1.25rem',
    maxWidth: 320,
    lineHeight: 1.4,
  },
  demoSection: {
    width: '100%',
    maxWidth: 360,
    marginBottom: '1.25rem',
  },
  demoLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  demoRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  demoChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.6rem 0.85rem',
    borderRadius: '10px',
    border: '2px solid rgba(255,255,255,0.1)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
    background: '#1B2330',
  },
  demoChipIcon: {
    fontSize: '1.1rem',
  },
  demoChipLabel: {
    fontSize: '0.85rem',
  },
  ageChip: {
    padding: '0.55rem 0.75rem',
    borderRadius: '10px',
    border: '2px solid rgba(255,255,255,0.1)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
    background: '#1B2330',
  },
  skipBtn: {
    marginTop: '0.75rem',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: '0.5rem',
    WebkitTapHighlightColor: 'transparent',
  },
};
