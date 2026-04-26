/**
 * OnboardingV3 — clean three-step farmer onboarding.
 *
 *   Step 1 — Farmer Setup   : isNewFarmer, country, language
 *   Step 2 — Farm Basics    : farmName, farmType, farmSize, sizeUnit
 *   Step 3 — Crop Setup     : mainCrop, cropStage
 *
 * The flow is intentionally lean — anything optional / advanced (e.g.
 * state/region, planting date, labour, detailed tasks) is deferred
 * until AFTER onboarding completes so a first-time farmer hits the
 * dashboard in under 60 seconds.
 *
 * Storage contract:
 *   • every value saved is a canonical code, never a translated label
 *   • labels render via get{FarmType,Unit,CropStage,Crop}Label(code, lang)
 *     so language switching updates every chip / dropdown in place
 *   • old records that stored English labels are normalized back to
 *     codes via normalizeFarmType / normalizeSizeUnit / normalizeCrop
 *     (see src/config/onboardingLabels.js + src/config/crops.js)
 *
 * Completion:
 *   • writes the farm via farrowayLocal.saveFarm (+ setActiveFarmId)
 *   • writes { onboardingCompleted: true, isNewFarmer } to localStorage
 *     under 'farroway.onboardingV3' so guards / dashboards can read it
 *   • redirects new farmers to /today (beginner-friendly landing with
 *     primary task card) and existing farmers to /dashboard
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTranslation, LANGUAGES, setLanguage as setLangGlobally }
  from '../../i18n/index.js';
import {
  saveFarm, setActiveFarmId,
} from '../../store/farrowayLocal.js';
import {
  getFarmTypeLabel, getUnitLabel, getCropStageLabel,
  normalizeFarmType, normalizeSizeUnit, normalizeCropStage,
  getAllowedSizeUnits, getDefaultSizeUnit, convertSize, getFarmSizeLabel,
  FARM_TYPES, SIZE_UNITS, CROP_STAGES,
} from '../../config/onboardingLabels.js';
import {
  searchCrops, normalizeCrop, getCropLabel, CROP_OTHER,
} from '../../config/crops.js';
import { convertArea } from '../../lib/units/areaConversion.js';
import COUNTRIES from '../../utils/countries.js';
import { detectCountryByIP } from '../../utils/geolocation.js';
import { getCropLabelSafe } from '../../utils/crops.js';

const ONBOARDING_KEY = 'farroway.onboardingV3';
const DRAFT_KEY      = 'farroway.onboardingV3.draft';

function safeGetDraft() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function safeSetDraft(draft) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* quota / SSR — ignore */ }
}
function safeClearDraft() {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  } catch { /* ignore */ }
}

function markOnboardingComplete({ isNewFarmer }) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      onboardingCompleted: true,
      isNewFarmer:         !!isNewFarmer,
      completedAt:         Date.now(),
    }));
  } catch { /* ignore */ }
}

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

// ─── Component ───────────────────────────────────────────────────
export default function OnboardingV3() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();

  // ── Draft restore ──
  const [form, setForm] = useState(() => {
    const draft = safeGetDraft();
    return draft || {
      isNewFarmer: null,
      country:     '',
      language:    lang || 'en',
      farmName:    '',
      farmType:    'small_farm',
      farmSize:    '',
      sizeUnit:    'ACRE',
      mainCrop:    '',
      cropOther:   '',
      cropStage:   'planning',
    };
  });
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [cropQuery, setCropQuery] = useState(() =>
    form.mainCrop ? getCropLabelSafe(form.mainCrop, lang) : '');

  // Persist the form to localStorage so a refresh mid-flow doesn't
  // wipe entered values. Never save passwords / tokens — this is a
  // pure UI draft.
  useEffect(() => { safeSetDraft(form); }, [form]);

  // ── Country auto-detect (silent) ──
  // Runs once on mount; only fills the field if the user hasn't
  // already picked a country. Fail-silent so a slow/blocked IP lookup
  // doesn't prevent the farmer from moving forward.
  const detectTriedRef = useRef(false);
  useEffect(() => {
    if (detectTriedRef.current) return;
    detectTriedRef.current = true;
    if (form.country) return;
    (async () => {
      try {
        const detected = await detectCountryByIP();
        if (detected && !form.country) {
          setForm((f) => ({ ...f, country: detected.toUpperCase() }));
        }
      } catch { /* silent fallback */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──
  const update = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  }, []);

  // Transient info message — shown once when the farmer's typed
  // size is auto-converted because they switched unit or farm type.
  // Cleared on the next edit or next step navigation.
  const [conversionNotice, setConversionNotice] = useState('');

  // Changing farm type CAN cross unit tiers:
  //   backyard (sqft/sqm) ↔ small/commercial (acres/hectares)
  // Per spec §5C: convert the value across tiers via the canonical
  // area helper (sqft → sqm → acres/hectares) instead of resetting.
  // The farmer keeps their area in a sensible unit; we surface a
  // subtle info line so the number change isn't mysterious.
  const changeFarmType = useCallback((nextType) => {
    setForm((f) => {
      const prev = normalizeFarmType(f.farmType);
      const next = normalizeFarmType(nextType);
      if (prev === next) return { ...f, farmType: next };
      const allowed = getAllowedSizeUnits(next, f.country);
      const currentUnit = normalizeSizeUnit(f.sizeUnit);
      const stillOk = allowed.includes(currentUnit);
      if (stillOk) return { ...f, farmType: next };

      const newUnit = allowed[0];
      const numeric = Number(f.farmSize);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return { ...f, farmType: next, sizeUnit: newUnit };
      }
      // Map uppercase storage codes to the canonical lowercase
      // accepted by convertArea.
      const LC = { ACRE: 'acres', HECTARE: 'hectares', SQFT: 'sqft', SQM: 'sqm' };
      const converted = convertArea(numeric, LC[currentUnit], LC[newUnit]);
      if (converted == null) {
        return { ...f, farmType: next, sizeUnit: newUnit, farmSize: '' };
      }
      setConversionNotice('converted');
      return {
        ...f, farmType: next, sizeUnit: newUnit,
        farmSize: String(converted),
      };
    });
    setErrors((e) => {
      if (!e.farmType && !e.sizeUnit && !e.farmSize) return e;
      const { farmType: _a, sizeUnit: _b, farmSize: _c, ...rest } = e;
      return rest;
    });
  }, []);

  // Switching within the same tier (sqft ↔ sqm, acres ↔ hectares)
  // converts the numeric value so the farmer doesn't lose context.
  const changeSizeUnit = useCallback((nextUnit) => {
    setForm((f) => {
      const fromUnit = normalizeSizeUnit(f.sizeUnit);
      const toUnit   = normalizeSizeUnit(nextUnit);
      if (fromUnit === toUnit) return { ...f, sizeUnit: toUnit };
      const numeric = Number(f.farmSize);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return { ...f, sizeUnit: toUnit };   // nothing to convert
      }
      const { value, ok } = convertSize(numeric, fromUnit, toUnit);
      if (ok && value != null) setConversionNotice('converted');
      return {
        ...f,
        sizeUnit: toUnit,
        farmSize: ok && value != null ? String(value) : f.farmSize,
      };
    });
    setErrors((e) => (e.sizeUnit ? { ...e, sizeUnit: undefined } : e));
  }, []);

  // Keep the allowed-unit list reactive to both farmType AND country
  // (US backyard → sqft first, elsewhere → sqm first).
  const allowedUnits = useMemo(
    () => getAllowedSizeUnits(form.farmType, form.country),
    [form.farmType, form.country],
  );

  const cropSuggestions = useMemo(
    () => searchCrops(cropQuery, { limit: 12, lang }),
    [cropQuery, lang],
  );

  // ── Step-gated validation ──
  function validateStep(n) {
    const errs = {};
    if (n === 1) {
      if (form.isNewFarmer === null) {
        errs.isNewFarmer = resolve(t, 'onboarding.err.isNewFarmer',
          'Please tell us if you are new to farming.');
      }
      if (!form.country) {
        errs.country = resolve(t, 'onboarding.err.country',
          'Please choose your country.');
      }
    } else if (n === 2) {
      if (!form.farmName.trim()) {
        errs.farmName = resolve(t, 'onboarding.err.farmName',
          'Please give your farm a name.');
      }
      if (!FARM_TYPES.includes(normalizeFarmType(form.farmType))) {
        errs.farmType = resolve(t, 'onboarding.err.farmType',
          'Please pick a farm type.');
      }
      const sizeNum = Number(form.farmSize);
      if (!form.farmSize || !Number.isFinite(sizeNum) || sizeNum <= 0) {
        errs.farmSize = resolve(t, 'onboarding.err.farmSize',
          'Enter a farm size greater than zero.');
      }
      if (!SIZE_UNITS.includes(normalizeSizeUnit(form.sizeUnit))) {
        errs.sizeUnit = resolve(t, 'onboarding.err.sizeUnit',
          'Pick acres or hectares.');
      }
    } else if (n === 3) {
      if (!form.mainCrop) {
        errs.mainCrop = resolve(t, 'onboarding.err.mainCrop',
          'Please pick your main crop.');
      } else if (form.mainCrop === CROP_OTHER && !form.cropOther.trim()) {
        errs.mainCrop = resolve(t, 'onboarding.err.cropOther',
          'Please name your crop.');
      }
      if (!CROP_STAGES.includes(normalizeCropStage(form.cropStage))) {
        errs.cropStage = resolve(t, 'onboarding.err.cropStage',
          'Please pick the current stage.');
      }
    }
    return errs;
  }

  const currentErrors = useMemo(() => validateStep(step),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, form]);
  const canContinue = Object.keys(currentErrors).length === 0;

  function handleNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (step === 1 && form.language && form.language !== lang) {
      // Commit language early so step 2/3 render in the chosen locale.
      try { setLangGlobally(form.language); } catch { /* ignore */ }
    }
    setStep((s) => Math.min(3, s + 1));
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }
  function handleBack() {
    setErrors({});
    if (step > 1) {
      setStep((s) => Math.max(1, s - 1));
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    } else {
      // First step — exit onboarding to login or home. Confirm only
      // if the user typed something they'd lose.
      const dirty = !!(form.country || form.isNewFarmer !== null);
      if (!dirty || (typeof window !== 'undefined'
          && window.confirm(resolve(t, 'onboarding.exitConfirm',
              'Leave onboarding? Your progress will be kept for next time.')))) {
        navigate('/login');
      }
    }
  }

  async function handleFinish() {
    const errs = validateStep(3);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaveError('');
    setSaving(true);
    try {
      const cropCode = form.mainCrop === CROP_OTHER
        ? normalizeCrop(form.cropOther)
        : normalizeCrop(form.mainCrop);

      const farm = saveFarm({
        name:      form.farmName.trim(),
        crop:      cropCode,
        // Store the English label so cached data is stable across
        // language switches; UI translates on render via
        // useCropLabel / getCropLabelSafe(code, lang).
        cropLabel: form.mainCrop === CROP_OTHER
          ? (form.cropOther.trim() || 'Other')
          : getCropLabelSafe(cropCode, 'en'),
        country:   form.country,
        farmSize:  Number(form.farmSize),
        sizeUnit:  normalizeSizeUnit(form.sizeUnit),
        stage:     normalizeCropStage(form.cropStage),
        farmType:  normalizeFarmType(form.farmType),
        setActive: true,
      });
      if (farm && farm.id) { try { setActiveFarmId(farm.id); } catch { /* ignore */ } }

      markOnboardingComplete({ isNewFarmer: form.isNewFarmer === true });
      safeClearDraft();

      // New farmers land on /today with the beginner task card; more
      // seasoned farmers go straight to the main dashboard.
      navigate(form.isNewFarmer ? '/today' : '/dashboard', { replace: true });
    } catch (err) {
      setSaveError(resolve(t, 'onboarding.err.saveGeneric',
        'We could not save your farm right now. Please try again.'));
      // Keep the draft + step so the farmer doesn't lose data on
      // a transient failure.
      // eslint-disable-next-line no-console
      console.error('[onboarding-v3] save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  // ─── Copy ──────────────────────────────────────────────────────
  const L = {
    stepOf: (n) => resolve(t, 'onboarding.stepOf', 'Step {{n}} of 3').replace('{{n}}', String(n)),
    backLbl:    resolve(t, 'common.back',     'Back'),
    continueLbl:resolve(t, 'onboarding.continue', 'Continue'),
    finishLbl:  resolve(t, 'onboarding.finish',   'Save & finish'),
    savingLbl:  resolve(t, 'onboarding.saving',   'Saving\u2026'),
    title1:     resolve(t, 'onboarding.step1.title',    'Let\u2019s get you set up'),
    sub1:       resolve(t, 'onboarding.step1.subtitle', 'A few quick questions so we can tailor Farroway to your farm.'),
    newFarmerLbl: resolve(t, 'onboarding.isNewFarmer',  'Are you new to farming?'),
    yesLbl:     resolve(t, 'common.yes', 'Yes'),
    noLbl:      resolve(t, 'common.no',  'No'),
    countryLbl: resolve(t, 'onboarding.country', 'Country'),
    countryPh:  resolve(t, 'onboarding.countryPh', 'Select your country'),
    languageLbl:resolve(t, 'onboarding.language', 'Preferred language'),
    title2:     resolve(t, 'onboarding.step2.title',    'Tell us about your farm'),
    sub2:       resolve(t, 'onboarding.step2.subtitle', 'Just the basics — you can edit the rest later.'),
    farmNameLbl:resolve(t, 'onboarding.farmName', 'Farm name'),
    farmNamePh: resolve(t, 'onboarding.farmNamePh', 'e.g. Home plot, Mavuno farm'),
    farmTypeLbl:resolve(t, 'onboarding.farmType', 'Farm type'),
    farmSizeLbl:resolve(t, 'onboarding.farmSize', 'Farm size'),
    farmSizePh: resolve(t, 'onboarding.farmSizePh', 'e.g. 2.5'),
    sizeUnitLbl:resolve(t, 'onboarding.sizeUnit', 'Unit'),
    title3:     resolve(t, 'onboarding.step3.title',    'What are you growing?'),
    sub3:       resolve(t, 'onboarding.step3.subtitle', 'Pick your main crop and the stage it\u2019s at today.'),
    cropLbl:    resolve(t, 'onboarding.mainCrop', 'Main crop'),
    cropSearch: resolve(t, 'onboarding.cropSearch', 'Search common crops\u2026'),
    cropOtherPh:resolve(t, 'onboarding.cropOtherPh', 'Name your crop'),
    cropStageLbl:resolve(t, 'onboarding.cropStage', 'Current stage'),
  };

  return (
    <main style={S.page} data-screen="onboarding-v3" data-step={step}>
      <div style={S.card}>
        {/* Step indicator + Back */}
        <div style={S.header}>
          <button
            type="button"
            onClick={handleBack}
            style={S.backBtn}
            data-testid="onboarding-back"
            aria-label={L.backLbl}
          >
            <span aria-hidden="true">{'\u2190'}</span>
            <span>{L.backLbl}</span>
          </button>
          <span style={S.stepChip}>{L.stepOf(step)}</span>
        </div>

        <StepProgress step={step} />

        {/* ───── Step 1 ───── */}
        {step === 1 && (
          <>
            <h1 style={S.title}>{L.title1}</h1>
            <p style={S.subtitle}>{L.sub1}</p>

            <Field label={L.newFarmerLbl} error={errors.isNewFarmer}>
              <div style={S.chipRow} data-testid="onboarding-is-new-farmer">
                <ChoiceChip
                  active={form.isNewFarmer === true}
                  onClick={() => update('isNewFarmer', true)}
                  label={L.yesLbl}
                  testid="onboarding-new-farmer-yes"
                />
                <ChoiceChip
                  active={form.isNewFarmer === false}
                  onClick={() => update('isNewFarmer', false)}
                  label={L.noLbl}
                  testid="onboarding-new-farmer-no"
                />
              </div>
            </Field>

            <Field label={L.countryLbl} error={errors.country}>
              <select
                className="form-select"
                value={form.country}
                onChange={(e) => update('country', e.target.value)}
                style={S.select}
                data-testid="onboarding-country"
                aria-invalid={!!errors.country}
              >
                <option value="">{L.countryPh}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.iso2} value={c.iso2}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label={L.languageLbl}>
              <select
                className="form-select"
                value={form.language}
                onChange={(e) => {
                  update('language', e.target.value);
                  // Live-preview — commit the language change now so
                  // every label below updates as the user picks.
                  try { setLangGlobally(e.target.value); } catch { /* ignore */ }
                }}
                style={S.select}
                data-testid="onboarding-language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        {/* ───── Step 2 ───── */}
        {step === 2 && (
          <>
            <h1 style={S.title}>{L.title2}</h1>
            <p style={S.subtitle}>{L.sub2}</p>

            <Field label={L.farmNameLbl} error={errors.farmName}>
              <input
                type="text"
                value={form.farmName}
                onChange={(e) => update('farmName', e.target.value)}
                placeholder={L.farmNamePh}
                style={{
                  ...S.input,
                  ...(errors.farmName ? S.inputError : {}),
                }}
                data-testid="onboarding-farm-name"
                aria-invalid={!!errors.farmName}
                autoFocus
              />
            </Field>

            <Field label={L.farmTypeLbl} error={errors.farmType}>
              <div style={S.chipRow} data-testid="onboarding-farm-type">
                {FARM_TYPES.map((code) => (
                  <ChoiceChip
                    key={code}
                    active={normalizeFarmType(form.farmType) === code}
                    onClick={() => changeFarmType(code)}
                    label={getFarmTypeLabel(code, lang)}
                    testid={`onboarding-farm-type-${code}`}
                  />
                ))}
              </div>
            </Field>

            <div style={S.row}>
              <Field
                label={getFarmSizeLabel(form.farmType, lang)}
                error={errors.farmSize}
                style={{ flex: 1 }}
              >
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.farmSize}
                  onChange={(e) => {
                    update('farmSize', e.target.value);
                    if (conversionNotice) setConversionNotice('');
                  }}
                  placeholder={L.farmSizePh}
                  style={{
                    ...S.input,
                    ...(errors.farmSize ? S.inputError : {}),
                  }}
                  data-testid="onboarding-farm-size"
                  aria-invalid={!!errors.farmSize}
                />
              </Field>
              <Field label={L.sizeUnitLbl} style={{ width: '9rem' }}>
                {/* Chip list is driven by the current farmType + country:
                    backyard → SQFT / SQM (US: sqft first, else sqm first)
                    small / commercial → ACRE / HECTARE (US: acres first,
                    else hectares first). Within-tier switches auto-
                    convert the numeric value; cross-tier switches (via
                    changeFarmType) also convert via the canonical
                    square-meter base. */}
                <div style={S.chipRow} data-testid="onboarding-size-unit">
                  {allowedUnits.map((u) => (
                    <ChoiceChip
                      key={u}
                      active={normalizeSizeUnit(form.sizeUnit) === u}
                      onClick={() => changeSizeUnit(u)}
                      label={getUnitLabel(u, lang)}
                      testid={`onboarding-size-unit-${u.toLowerCase()}`}
                    />
                  ))}
                </div>
              </Field>
            </div>
            {/* Helper text that tells the farmer which units fit
                their farm type. Localised via t(). */}
            <p style={S.helperText} data-testid="onboarding-size-helper">
              {normalizeFarmType(form.farmType) === 'backyard'
                ? resolve(t, 'onboarding.sizeHelper.backyard',
                    'Use square feet or square meters for home/backyard farms.')
                : resolve(t, 'onboarding.sizeHelper.land',
                    'Use acres or hectares for larger farms.')}
            </p>
            {/* Subtle notice shown when switching unit/tier auto-
                converted the entered value so the number change isn't
                mysterious. Clears on the farmer's next size edit. */}
            {conversionNotice && (
              <p style={S.conversionNotice}
                 data-testid="onboarding-size-conversion-notice">
                {resolve(t, 'onboarding.sizeConverted',
                  'Size converted to match selected unit.')}
              </p>
            )}
          </>
        )}

        {/* ───── Step 3 ───── */}
        {step === 3 && (
          <>
            <h1 style={S.title}>{L.title3}</h1>
            <p style={S.subtitle}>{L.sub3}</p>

            <Field label={L.cropLbl} error={errors.mainCrop}>
              <input
                type="text"
                value={cropQuery}
                onChange={(e) => {
                  setCropQuery(e.target.value);
                  if (!e.target.value) update('mainCrop', '');
                }}
                placeholder={L.cropSearch}
                style={{
                  ...S.input,
                  ...(errors.mainCrop ? S.inputError : {}),
                }}
                data-testid="onboarding-crop-search"
                aria-invalid={!!errors.mainCrop}
              />
              <div style={S.chipRow} data-testid="onboarding-crop-suggestions">
                {cropSuggestions.map((c) => {
                  const picked = form.mainCrop === c.code;
                  return (
                    <ChoiceChip
                      key={c.code}
                      active={picked}
                      onClick={() => {
                        update('mainCrop', c.code);
                        if (c.code !== CROP_OTHER) {
                          setCropQuery(getCropLabelSafe(c.code, lang));
                        }
                      }}
                      label={getCropLabelSafe(c.code, lang)}
                      testid={`onboarding-crop-${c.code}`}
                    />
                  );
                })}
              </div>
              {form.mainCrop === CROP_OTHER && (
                <input
                  type="text"
                  value={form.cropOther}
                  onChange={(e) => update('cropOther', e.target.value)}
                  placeholder={L.cropOtherPh}
                  style={{ ...S.input, marginTop: '0.5rem' }}
                  data-testid="onboarding-crop-other"
                />
              )}
            </Field>

            <Field label={L.cropStageLbl} error={errors.cropStage}>
              <select
                className="form-select"
                value={form.cropStage}
                onChange={(e) => update('cropStage', e.target.value)}
                style={S.select}
                data-testid="onboarding-crop-stage"
                aria-invalid={!!errors.cropStage}
              >
                {CROP_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {getCropStageLabel(s, lang)}
                  </option>
                ))}
              </select>
            </Field>

            {saveError && (
              <div style={S.saveError} role="alert" data-testid="onboarding-save-error">
                {saveError}
              </div>
            )}
          </>
        )}

        {/* CTA row */}
        <div style={S.ctaRow}>
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canContinue}
              style={{
                ...S.primaryBtn,
                ...(canContinue ? {} : S.primaryBtnDisabled),
              }}
              data-testid="onboarding-continue"
            >
              {L.continueLbl}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving || !canContinue}
              style={{
                ...S.primaryBtn,
                ...(saving || !canContinue ? S.primaryBtnDisabled : {}),
              }}
              data-testid="onboarding-finish"
            >
              {saving ? L.savingLbl : L.finishLbl}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Small components ────────────────────────────────────────────
function StepProgress({ step }) {
  return (
    <div style={S.progressRow} aria-hidden="true" data-testid="onboarding-progress">
      {[1, 2, 3].map((n) => (
        <div key={n} style={{
          ...S.progressDot,
          ...(n <= step ? S.progressDotActive : {}),
        }} />
      ))}
    </div>
  );
}

function Field({ label, error, children, style }) {
  return (
    <label style={{ ...S.label, ...style }}>
      <span style={S.labelText}>{label}</span>
      {children}
      {error && <span style={S.fieldError} role="alert">{error}</span>}
    </label>
  );
}

function ChoiceChip({ active, onClick, label, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...S.chip, ...(active ? S.chipActive : {}) }}
      data-testid={testid}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

// ─── Styles (Farroway dark theme, mobile-first) ─────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#EAF2FF',
    padding: '1rem',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '32rem',
    padding: '1rem 0 3rem',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 0.75rem', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.875rem', fontWeight: 600,
    cursor: 'pointer', minHeight: 40,
  },
  stepChip: {
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.14)', color: '#86EFAC',
    fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.3,
  },
  progressRow: {
    display: 'flex', gap: '0.375rem', marginBottom: '1.25rem',
  },
  progressDot: {
    flex: 1, height: 4, borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
  },
  progressDotActive: { background: '#22C55E' },
  title: {
    fontSize: '1.5rem', fontWeight: 700, margin: 0,
    color: '#FFFFFF', lineHeight: 1.25,
  },
  subtitle: {
    color: '#9FB3C8', fontSize: '0.9375rem',
    marginTop: '0.375rem', marginBottom: '1.5rem', lineHeight: 1.5,
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
    marginBottom: '1rem',
  },
  labelText: {
    fontSize: '0.8125rem', fontWeight: 600, color: '#9FB3C8',
  },
  row: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' },
  input: {
    padding: '0.75rem 0.875rem', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#111827', color: '#EAF2FF',
    fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
    width: '100%', minHeight: 44,
  },
  select: {
    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
    colorScheme: 'dark',
    padding: '0.75rem 2.25rem 0.75rem 0.875rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.18)',
    background: '#0F1F3A '
      + 'url("data:image/svg+xml;utf8,'
      + '<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22>'
      + '<path fill=%22none%22 stroke=%22%239FB3C8%22 stroke-width=%221.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M2 4l4 4 4-4%22/>'
      + '</svg>") '
      + 'no-repeat right 0.75rem center / 12px 12px',
    color: '#EAF2FF', fontSize: '0.9375rem', outline: 'none',
    boxSizing: 'border-box', minHeight: 44, width: '100%', cursor: 'pointer',
  },
  inputError: { borderColor: 'rgba(239,68,68,0.55)', background: 'rgba(239,68,68,0.04)' },
  helperText: {
    fontSize: '0.75rem', color: '#9FB3C8',
    marginTop: '0.25rem', marginBottom: 0, lineHeight: 1.4,
  },
  conversionNotice: {
    marginTop: '0.5rem', marginBottom: 0,
    padding: '0.5rem 0.75rem', borderRadius: 10,
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.28)',
    color: '#86EFAC', fontSize: '0.8125rem', lineHeight: 1.4,
  },
  fieldError: { color: '#FCA5A5', fontSize: '0.8125rem' },
  chipRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  chip: {
    padding: '0.625rem 1rem', borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.875rem', fontWeight: 600,
    cursor: 'pointer', minHeight: 40, boxSizing: 'border-box',
  },
  chipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.14)',
    color: '#86EFAC',
  },
  ctaRow: {
    marginTop: '1.25rem',
    // Sticky CTA on mobile so the continue button is always reachable.
    position: 'sticky', bottom: 0,
    background: 'linear-gradient(180deg, rgba(11,29,52,0) 0%, #0B1D34 35%)',
    paddingTop: '1rem', paddingBottom: '0.25rem',
  },
  primaryBtn: {
    width: '100%', padding: '0.875rem 1rem', borderRadius: 12,
    border: 'none', background: '#22C55E', color: '#07210E',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
    minHeight: 48,
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  primaryBtnDisabled: { opacity: 0.55, cursor: 'not-allowed' },
  saveError: {
    padding: '0.75rem 0.875rem', borderRadius: 12,
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: '0.875rem',
    marginBottom: '0.5rem',
  },
};
