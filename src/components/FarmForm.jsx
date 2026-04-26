/**
 * FarmForm — canonical create/edit form for a farm profile.
 *
 * Drop-in create+edit UI for `/api/v2/farm-profile/new` and
 * `PATCH /api/v2/farm-profile/:id`. Keeps the visual design from
 * the original draft (dark card, chip-style farm-type picker,
 * two-column size row) but plugs into Farroway's existing
 * infrastructure so every value on the wire is canonical:
 *
 *   crop       → lowercase canonical ('cassava', 'pepper') via
 *                normalizeCropKey (legacy "Pepper / chili",
 *                "Cassava", localised aliases all collapse)
 *   farmType   → 'backyard' | 'small_farm' | 'commercial'
 *   sizeUnit   → 'sqft' | 'sqm' | 'acres' | 'hectares' (legacy
 *                'sq ft' / 'ACRE' / 'hekta' collapse via normalizeUnit)
 *   cropStage  → canonical stage key (resolveStage handles
 *                'land_prep' → 'land_preparation' etc.)
 *   country    → ISO-2 from src/config/countriesStates.js
 *   state      → per-country options from the same catalog
 *
 * Labels in the UI are all translated at render time via the
 * existing useTranslation + useCropLabel + useUnitLabel +
 * useFarmTypeLabel hooks.
 *
 * Two new fields to feed the timeline / harvest systems:
 *   plantingDate        — optional ISO date (YYYY-MM-DD)
 *   manualStageOverride — boolean flag; when on, cropStage is
 *                         persisted as the override and the
 *                         timeline engine stops auto-advancing.
 *
 * Network: uses the shared src/lib/api.js helpers (cookies +
 * retries) and surfaces backend error messages via formatApiError
 * rather than a generic "Validation failed".
 *
 * Debug preview box is gated to import.meta.env.DEV only.
 */

import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '../i18n/index.js';
import { CROPS, ALL_CROPS_WITH_OTHER, OTHER_CROP, getCropLabel, normalizeCropCode, parseCropValue, buildOtherCropValue, getCropLabelSafe } from '../utils/crops.js';
import { STAGES, STAGE_KEYS, resolveStage, getStagesForCrop } from '../utils/cropStages.js';
import {
  COUNTRIES, getCountryLabel, getStatesForCountry, hasStatesForCountry,
} from '../config/countriesStates.js';
import {
  FARM_TYPES, normalizeFarmType, getFarmTypeLabel,
} from '../config/onboardingLabels.js';
import {
  toSquareMeters, fromSquareMeters, convertArea,
  normalizeUnit, getDefaultUnit, getAllowedUnits, getAreaUnitLabel,
} from '../lib/units/areaConversion.js';
import { normalizeCropKey as normalizeI18nCropKey } from '../utils/localization.js';
import { createNewFarm, updateFarm } from '../lib/api.js';
import { formatApiError } from '../api/client.js';

const DEFAULT_FORM = Object.freeze({
  farmName:            '',
  crop:                '',     // stored as canonical lowercase (pepper, cassava, 'OTHER:Teff')
  otherCropName:       '',
  country:             '',
  state:               '',
  farmType:            '',     // backyard | small_farm | commercial
  farmSize:            '',
  sizeUnit:            '',     // sqft | sqm | acres | hectares
  cropStage:           '',     // canonical stage key
  plantingDate:        '',
  manualStageOverride: false,
  isActiveFarm:        true,
});

/**
 * buildInitialForm — normalise every incoming field so the form
 * opens with CANONICAL values even when the backend (or a legacy
 * record) handed us display strings like "Pepper / chili" or
 * "sq ft". The rest of the form assumes canonical from here on.
 */
function buildInitialForm(initialData) {
  if (!initialData) return { ...DEFAULT_FORM };

  // Crop: accept old display strings ("Cassava", "Pepper / chili")
  // + new canonical codes. parseCropValue handles "OTHER:Teff".
  const parsedCrop = parseCropValue(initialData.crop || initialData.cropType);
  let cropCanon = '';
  let otherName = initialData.otherCropName || '';
  if (parsedCrop) {
    if (parsedCrop.code === 'OTHER') {
      cropCanon = 'OTHER';
      otherName = parsedCrop.name || otherName;
    } else {
      cropCanon = (parsedCrop.code || '').toLowerCase();
    }
  } else if (initialData.crop) {
    // Fall back to the i18n alias map (catches localised crop names).
    cropCanon = normalizeI18nCropKey(initialData.crop) || '';
  }

  // Stage: resolveStage folds every legacy name onto a canonical one.
  const stage = resolveStage(initialData.cropStage || initialData.stage) || '';

  // Size unit: normalizeUnit accepts 'sq ft', 'sqft', 'SQM', 'ACRE', etc.
  const unit = normalizeUnit(initialData.sizeUnit) || '';

  // Farm type: normalizeFarmType maps 'Small Farm', 'small-farm', etc.
  const farmType = normalizeFarmType(initialData.farmType) || '';

  return {
    farmName:      initialData.farmName || initialData.name || '',
    crop:          cropCanon,
    otherCropName: otherName,
    country:       (initialData.country || initialData.countryCode || '').toUpperCase(),
    state:         initialData.state || initialData.stateCode || '',
    farmType,
    farmSize:
      initialData.farmSize != null ? String(initialData.farmSize)
      : initialData.size != null ? String(initialData.size)
      : '',
    sizeUnit: unit,
    cropStage: stage,
    plantingDate: toDateInput(initialData.plantingDate || initialData.plantedAt),
    manualStageOverride:
      !!(initialData.manualStageOverride && resolveStage(initialData.manualStageOverride)),
    isActiveFarm:
      typeof initialData.isActiveFarm === 'boolean' ? initialData.isActiveFarm : true,
  };
}

// Date <input type="date"> expects YYYY-MM-DD.
function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function FarmForm({
  initialData = null,
  mode         = 'create',
  onSuccess,
  onCancel,
} = {}) {
  const { t, lang } = useTranslation();
  const isEditing = mode === 'edit';

  const [form,         setForm]         = useState(() => buildInitialForm(initialData));
  const [errors,       setErrors]       = useState({});
  const [submitError,  setSubmitError]  = useState('');
  const [infoMessage,  setInfoMessage]  = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Allowed units depend on farmType + country (backyard+US → sqft first,
  // commercial+non-US → hectares first). Centralised in areaConversion.
  const allowedUnits = useMemo(
    () => getAllowedUnits({ farmType: form.farmType, countryCode: form.country }),
    [form.farmType, form.country],
  );

  const availableStates = useMemo(
    () => getStatesForCountry(form.country),
    [form.country],
  );

  // ─── Cross-field autocorrection ────────────────────────────
  // When farmType flips (backyard ↔ land tier), the old unit may no
  // longer be valid. Convert the typed size to the new default unit
  // and pin the unit — matches the onboarding flow's UX.
  useEffect(() => {
    if (!form.farmType) return;
    const nextAllowed = getAllowedUnits({
      farmType: form.farmType, countryCode: form.country,
    });
    const stillValid = nextAllowed.some((u) => u === form.sizeUnit);
    if (stillValid) return;

    const defaultUnit = getDefaultUnit({
      farmType: form.farmType, countryCode: form.country,
    });
    const oldSqm = toSquareMeters(form.farmSize, form.sizeUnit);
    setForm((prev) => {
      const next = { ...prev, sizeUnit: defaultUnit };
      if (oldSqm != null && defaultUnit) {
        const converted = fromSquareMeters(oldSqm, defaultUnit);
        if (converted != null && Number.isFinite(converted)) {
          next.farmSize = String(Number(converted.toFixed(2)));
          setInfoMessage(t('farm.sizeConverted')
            || 'Farm size converted to match the selected farm type.');
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.farmType, form.country]);

  // Country changed → if a state was selected that no longer exists
  // for the new country, clear it. If sizeUnit is empty but farmType
  // is set, pick the country-aware default.
  useEffect(() => {
    if (!form.country) return;
    setForm((prev) => {
      const next = { ...prev };
      if (!prev.sizeUnit && prev.farmType) {
        next.sizeUnit = getDefaultUnit({
          farmType: prev.farmType, countryCode: prev.country,
        });
      }
      if (prev.state
          && !availableStates.some((s) => s.code === prev.state)) {
        next.state = '';
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country, availableStates]);

  // ─── Handlers ─────────────────────────────────────────────
  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setSubmitError('');
    setInfoMessage('');
  }

  function handleUnitChange(nextUnit) {
    if (nextUnit === form.sizeUnit) return;
    const sqm = toSquareMeters(form.farmSize, form.sizeUnit);
    let nextSize = form.farmSize;
    if (sqm != null && nextUnit) {
      const converted = fromSquareMeters(sqm, nextUnit);
      if (converted != null && Number.isFinite(converted)) {
        nextSize = String(Number(converted.toFixed(2)));
        setInfoMessage(t('farm.sizeConverted')
          || 'Farm size converted to match the selected unit.');
      }
    }
    setForm((prev) => ({ ...prev, sizeUnit: nextUnit, farmSize: nextSize }));
    setErrors((prev) => ({ ...prev, sizeUnit: '', farmSize: '' }));
  }

  // ─── Validation ───────────────────────────────────────────
  function validate() {
    const next = {};
    if (!form.farmName.trim()) {
      next.farmName = t('farm.err.nameRequired') || 'Farm name is required.';
    }
    if (!form.crop) {
      next.crop = t('farm.err.cropRequired') || 'Main crop is required.';
    }
    if (form.crop === 'OTHER' && !form.otherCropName.trim()) {
      next.otherCropName = t('farm.err.otherCropRequired')
        || 'Please enter the crop name.';
    }
    if (!form.country) {
      next.country = t('farm.err.countryRequired') || 'Country is required.';
    }
    if (availableStates.length > 0 && !form.state) {
      next.state = t('farm.err.stateRequired') || 'State is required.';
    }
    if (!form.farmType) {
      next.farmType = t('farm.err.farmTypeRequired') || 'Farm type is required.';
    }
    if (!form.farmSize) {
      next.farmSize = t('farm.err.sizeRequired') || 'Farm size is required.';
    } else {
      const n = Number(form.farmSize);
      if (!Number.isFinite(n) || n <= 0) {
        next.farmSize = t('farm.err.sizePositive')
          || 'Farm size must be a number greater than 0.';
      }
    }
    if (!form.sizeUnit) {
      next.sizeUnit = t('farm.err.unitRequired') || 'Size unit is required.';
    }
    if (!form.cropStage) {
      next.cropStage = t('farm.err.stageRequired') || 'Crop stage is required.';
    }
    if (form.plantingDate) {
      const d = new Date(form.plantingDate);
      if (!Number.isFinite(d.getTime())) {
        next.plantingDate = t('farm.err.plantingDateInvalid')
          || 'Planting date is not valid.';
      } else if (d.getTime() > Date.now() + 86400000) {
        next.plantingDate = t('farm.err.plantingDateFuture')
          || 'Planting date cannot be in the future.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ─── Payload builder — CANONICAL VALUES ONLY ──────────────
  // Wire format matches what the /api/v2/farm-profile/{new,:id}
  // routes expect AFTER their alias normalisation. We ship BOTH
  // the frontend-canonical names (`crop`, `state`, `farmSize`) AND
  // the schema-canonical names (`cropType`, `stateCode`, `size`)
  // so the routes succeed regardless of which pair they read first.
  function buildPayload() {
    let cropCanon;
    if (form.crop === 'OTHER') {
      cropCanon = buildOtherCropValue(form.otherCropName);
    } else {
      cropCanon = (normalizeCropCode(form.crop) || '').toLowerCase();
    }

    // Frontend speaks canonical lowercase (sqft / sqm / acres /
    // hectares). The backend schema wants uppercase short codes
    // (SQFT / SQM / ACRE / HECTARE). Translate once, here.
    const unitCanonLower = normalizeUnit(form.sizeUnit);
    const SERVER_UNIT = { sqft: 'SQFT', sqm: 'SQM',
                          acres: 'ACRE', hectares: 'HECTARE' };
    const unitForServer = SERVER_UNIT[unitCanonLower] || null;

    const stageCanon = resolveStage(form.cropStage) || form.cropStage;
    const farmTypeCanon = normalizeFarmType(form.farmType);
    const sizeNum = Number(form.farmSize);

    const payload = {
      farmName:          form.farmName.trim(),

      // Crop — ship both aliases so the route accepts us regardless.
      crop:              cropCanon,
      cropType:          cropCanon,
      otherCropName:     cropCanon && cropCanon.startsWith('OTHER:')
        ? form.otherCropName.trim() : '',

      // Country + state — canonical + schema-canonical aliases.
      country:           form.country,
      state:             form.state || '',
      stateCode:         form.state || '',

      // Farm type — already canonical lowercase via normalizeFarmType.
      farmType:          farmTypeCanon,

      // Size — ship the number under `size` (schema), `farmSize`
      // (legacy), and `normalizedAreaSqm` (timeline + intelligence).
      size:              sizeNum,
      farmSize:          sizeNum,
      sizeUnit:          unitForServer,        // UPPERCASE for the schema
      normalizedAreaSqm: toSquareMeters(sizeNum, unitCanonLower),

      // Stage + planting date feed the timeline engine.
      cropStage:         stageCanon,
      plantingDate:      form.plantingDate || null,
      plantedAt:         form.plantingDate || null,   // schema alias
      manualStageOverride: form.manualStageOverride ? stageCanon : null,

      isActiveFarm:      Boolean(form.isActiveFarm),
    };
    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) {
      setSubmitError(t('farm.err.fixHighlighted')
        || 'Please fix the highlighted fields.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const payload = buildPayload();
      const response = isEditing
        ? await updateFarm(initialData?.id, payload)
        : await createNewFarm(payload);
      if (typeof onSuccess === 'function') onSuccess(response);
    } catch (error) {
      // Lift backend fieldErrors onto the matching inline form
      // fields so the user sees EXACTLY what to fix (not a generic
      // "Validation failed"). Fallback to a readable banner line
      // via formatApiError for non-field errors.
      const payload = (error && (error.response?.data || error.data || error)) || {};
      const fe = payload && payload.fieldErrors;
      if (fe && typeof fe === 'object') {
        // Map server field names → local form field names.
        const SERVER_TO_LOCAL = {
          cropType:     'crop',
          stateCode:    'state',
          size:         'farmSize',
          sizeUnit:     'sizeUnit',
          farmName:     'farmName',
          farmerName:   'farmName',    // treat as farm-name error; farmForm has no farmerName field
          country:      'country',
          farmType:     'farmType',
          cropStage:    'cropStage',
          location:     'country',     // location is derived from country/state; flag country
        };
        const next = {};
        for (const [key, msg] of Object.entries(fe)) {
          const local = SERVER_TO_LOCAL[key] || key;
          next[local] = String(msg || '').trim();
        }
        if (Object.keys(next).length > 0) {
          setErrors((prev) => ({ ...prev, ...next }));
        }
      }
      setSubmitError(formatApiError(error,
        t('farm.err.saveFailed')
          || 'Unable to save the farm right now. Please check your inputs.'));
      // Swallow the console noise in prod, keep it in dev.
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('FARM_SAVE_ERROR', error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Display helpers ──────────────────────────────────────
  const sizeLabel = form.farmType === 'backyard'
    ? (t('farm.sizeLabelBackyard') || 'Farm Size (Small Area)')
    : (t('farm.sizeLabelLand')     || 'Farm Size (Land Area)');
  const sizeHelpText = form.farmType === 'backyard'
    ? (t('farm.sizeHelpBackyard')
        || 'Use square feet or square meters for home or backyard farms.')
    : (t('farm.sizeHelpLand')
        || 'Use acres or hectares for larger farms.');

  const cropOptions = ALL_CROPS_WITH_OTHER;

  const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

  return (
    <form onSubmit={handleSubmit} style={styles.form} noValidate>
      <div style={styles.card}>
        <h2 style={styles.title}>
          {isEditing
            ? (t('farm.editTitle') || 'Edit Farm')
            : (t('farm.createTitle') || 'Add New Farm')}
        </h2>
        <p style={styles.subtitle}>
          {isEditing
            ? (t('farm.editSubtitle') || 'Update your farm details without restarting setup.')
            : (t('farm.createSubtitle') || 'Add a farm using clean, validated values that match the system.')}
        </p>

        <Field label={t('farm.fields.name') || 'Farm Name'}
               required error={errors.farmName}>
          <input
            type="text"
            value={form.farmName}
            onChange={(e) => updateField('farmName', e.target.value)}
            placeholder={t('farm.fields.namePlaceholder') || 'Enter farm name'}
            style={styles.input}
            data-testid="farm-name"
          />
        </Field>

        <Field label={t('farm.fields.crop') || 'Main Crop'}
               required error={errors.crop}>
          <select
            value={form.crop === 'OTHER' ? 'OTHER' : (form.crop || '').toUpperCase()}
            onChange={(e) => {
              const v = e.target.value;
              updateField('crop', v === 'OTHER' ? 'OTHER' : v.toLowerCase());
            }}
            style={styles.input}
            data-testid="farm-crop"
          >
            <option value="">{t('farm.fields.cropPlaceholder') || 'Select crop'}</option>
            {cropOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {getCropLabelSafe(c.code, lang)}
              </option>
            ))}
          </select>
        </Field>

        {form.crop === 'OTHER' && (
          <Field label={t('farm.fields.otherCrop') || 'Other Crop Name'}
                 required error={errors.otherCropName}>
            <input
              type="text"
              value={form.otherCropName}
              onChange={(e) => updateField('otherCropName', e.target.value)}
              placeholder={t('farm.fields.otherCropPlaceholder') || 'Enter crop name'}
              style={styles.input}
              data-testid="farm-other-crop"
            />
          </Field>
        )}

        <Field label={t('farm.fields.country') || 'Country'}
               required error={errors.country}>
          <select
            value={form.country}
            onChange={(e) => updateField('country', e.target.value)}
            style={styles.input}
            data-testid="farm-country"
          >
            <option value="">{t('farm.fields.countryPlaceholder') || 'Select country'}</option>
            {COUNTRIES.map(([code]) => (
              <option key={code} value={code}>
                {getCountryLabel(code)}
              </option>
            ))}
          </select>
        </Field>

        {hasStatesForCountry(form.country) && (
          <Field label={t('farm.fields.state') || 'State'}
                 required error={errors.state}>
            <select
              value={form.state}
              onChange={(e) => updateField('state', e.target.value)}
              style={styles.input}
              data-testid="farm-state"
            >
              <option value="">{t('farm.fields.statePlaceholder') || 'Select state'}</option>
              {availableStates.map((s) => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t('farm.fields.farmType') || 'Farm Type'}
               required error={errors.farmType}>
          <div style={styles.chipRow}>
            {FARM_TYPES.map((code) => {
              const selected = form.farmType === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => updateField('farmType', code)}
                  style={{ ...styles.chip, ...(selected ? styles.chipActive : {}) }}
                  data-testid={`farm-type-${code}`}
                >
                  {getFarmTypeLabel(code)}
                </button>
              );
            })}
          </div>
        </Field>

        <div style={styles.twoCol}>
          <Field label={sizeLabel} required error={errors.farmSize}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={form.farmSize}
              onChange={(e) => updateField('farmSize', e.target.value)}
              placeholder={t('farm.fields.sizePlaceholder') || 'Enter farm size'}
              style={styles.input}
              data-testid="farm-size"
            />
            <small style={styles.helpText}>{sizeHelpText}</small>
          </Field>

          <Field label={t('farm.fields.sizeUnit') || 'Size Unit'}
                 required error={errors.sizeUnit}>
            <select
              value={form.sizeUnit}
              onChange={(e) => handleUnitChange(e.target.value)}
              style={styles.input}
              disabled={!form.farmType}
              data-testid="farm-unit"
            >
              <option value="">{t('farm.fields.sizeUnitPlaceholder') || 'Select unit'}</option>
              {allowedUnits.map((u) => (
                <option key={u} value={u}>{getAreaUnitLabel(u)}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t('farm.fields.plantingDate') || 'Planting Date (optional)'}
               error={errors.plantingDate}>
          <input
            type="date"
            value={form.plantingDate}
            onChange={(e) => updateField('plantingDate', e.target.value)}
            max={toDateInput(new Date())}
            style={styles.input}
            data-testid="farm-planting-date"
          />
          <small style={styles.helpText}>
            {t('farm.fields.plantingDateHelp')
              || 'Helps us estimate the current growth stage and remaining days until harvest.'}
          </small>
        </Field>

        <Field label={t('farm.fields.cropStage') || 'Crop Stage'}
               required error={errors.cropStage}>
          <select
            value={form.cropStage}
            onChange={(e) => updateField('cropStage', e.target.value)}
            style={styles.input}
            data-testid="farm-stage"
          >
            <option value="">{t('farm.fields.stagePlaceholder') || 'Select crop stage'}</option>
            {/*
              Crop Intelligence Layer: per-crop lifecycle stages.
              Cassava shows planting/establishment/vegetative/bulking/
              maturation/harvest; maize shows planting/germination/
              vegetative/tasseling/grain_fill/harvest; etc. Unknown
              crops fall back to the generic STAGES list so nothing
              breaks.
            */}
            {getStagesForCrop(form.crop).map((s) => (
              <option key={s.value} value={s.value}>
                {(t(s.labelKey) && t(s.labelKey) !== s.labelKey)
                  ? t(s.labelKey)
                  : s.value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </Field>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.manualStageOverride}
            onChange={(e) => updateField('manualStageOverride', e.target.checked)}
            data-testid="farm-manual-override"
          />
          <span>
            {t('farm.fields.manualOverride')
              || 'Lock this stage — don\u2019t auto-advance it based on planting date.'}
          </span>
        </label>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.isActiveFarm}
            onChange={(e) => updateField('isActiveFarm', e.target.checked)}
            data-testid="farm-active"
          />
          <span>
            {t('farm.fields.activeFarm')
              || 'Set this as my active farm after saving.'}
          </span>
        </label>

        {infoMessage && <div style={styles.infoBox} role="status">{infoMessage}</div>}
        {submitError && <div style={styles.errorBox} role="alert" data-testid="farm-submit-error">{submitError}</div>}

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={onCancel}
            style={styles.secondaryButton}
            disabled={isSubmitting}
            data-testid="farm-cancel"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            style={styles.primaryButton}
            disabled={isSubmitting}
            data-testid="farm-submit"
          >
            {isSubmitting
              ? (isEditing
                  ? (t('farm.saving') || 'Saving\u2026')
                  : (t('farm.creating') || 'Creating\u2026'))
              : (isEditing
                  ? (t('farm.saveChanges') || 'Save Changes')
                  : (t('farm.saveNew') || 'Save New Farm'))}
          </button>
        </div>

        {isDev && (
          <div style={styles.debugBox} data-testid="farm-form-debug">
            <strong>Canonical payload preview (dev only)</strong>
            <pre style={styles.pre}>
{JSON.stringify(
  (() => {
    try { return buildPayload(); } catch { return {}; }
  })(),
  null, 2,
)}
            </pre>
          </div>
        )}
      </div>
    </form>
  );
}

function Field({ label, required = false, error, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label} {required ? <span style={styles.required}>*</span> : null}
      </label>
      {children}
      {error ? <div style={styles.fieldError}>{error}</div> : null}
    </div>
  );
}

const styles = {
  form: { width: '100%', display: 'flex', justifyContent: 'center',
          padding: 16, background: '#031b34' },
  card: { width: '100%', maxWidth: 760, background: '#072545',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
          padding: 20, color: '#fff', boxSizing: 'border-box' },
  title: { margin: 0, marginBottom: 8, fontSize: 28, fontWeight: 700 },
  subtitle: { marginTop: 0, marginBottom: 20, color: '#b8c6d8', lineHeight: 1.5 },
  field: { marginBottom: 18 },
  label: { display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 16 },
  required: { color: '#35d46a' },
  input: { width: '100%', minHeight: 52, borderRadius: 12,
           border: '1px solid rgba(255,255,255,0.12)',
           background: '#0a2b50', color: '#fff',
           padding: '0 14px', fontSize: 18, boxSizing: 'border-box',
           outline: 'none', colorScheme: 'dark' },
  chipRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  chip: { minHeight: 44, padding: '0 16px', borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.15)',
          background: '#10365f', color: '#fff',
          cursor: 'pointer', fontSize: 16, fontWeight: 600 },
  chipActive: { background: '#143f1f', border: '1px solid #35d46a', color: '#8ff0a4' },
  twoCol: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 },
  helpText: { display: 'block', marginTop: 8, color: '#8ea7c0', lineHeight: 1.4 },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 10,
                 marginBottom: 18, color: '#d6e2ef' },
  infoBox: { background: 'rgba(32,126,255,0.12)',
             border: '1px solid rgba(32,126,255,0.35)',
             color: '#9dc4ff', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorBox: { background: 'rgba(255,77,77,0.12)',
              border: '1px solid rgba(255,77,77,0.35)',
              color: '#ff9e9e', borderRadius: 12, padding: 14, marginBottom: 16 },
  fieldError: { color: '#ff9e9e', marginTop: 8, fontSize: 14 },
  buttonRow: { display: 'flex', gap: 14, justifyContent: 'space-between', marginTop: 12 },
  secondaryButton: { flex: 1, minHeight: 54, borderRadius: 14,
                     border: '1px solid rgba(255,255,255,0.18)',
                     background: 'transparent', color: '#dfe9f5',
                     fontSize: 18, fontWeight: 700, cursor: 'pointer' },
  primaryButton: { flex: 1, minHeight: 54, borderRadius: 14, border: 'none',
                   background: '#2bd65f', color: '#fff',
                   fontSize: 18, fontWeight: 800, cursor: 'pointer' },
  debugBox: { marginTop: 20, padding: 14, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', color: '#b8c6d8' },
  pre: { margin: 0, marginTop: 8, whiteSpace: 'pre-wrap',
         wordBreak: 'break-word', fontSize: 13 },
};

// Silence unused imports so callers who tree-shake don't break.
void CROPS;
void convertArea;
