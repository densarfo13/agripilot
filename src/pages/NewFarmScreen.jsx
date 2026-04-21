/**
 * NewFarmScreen — structured, validated, usable "Add Another Farm"
 * page.
 *
 *   • country dropdown (global list)  + state dropdown (subdivisions
 *     only appear for countries we operate in)
 *   • searchable crop picker (common crops + "Other")
 *   • "Detect my location" button → navigator.geolocation
 *   • inline field errors; save disabled until required fields valid
 *   • optional "Set as active farm" toggle on save
 *   • success screen still prompts "Switch to this farm"
 *
 * Data flow unchanged at the API layer: we still call saveProfile
 * with newFarm:true, mirror to the farroway-local store, and let the
 * existing switch/stay buttons drive navigation.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import {
  saveFarm as farrowaySaveFarm,
  setActiveFarmId as farrowaySetActiveFarmId,
} from '../store/farrowayLocal.js';
import {
  COUNTRIES, getStatesForCountry, hasStatesForCountry,
  getCountryLabel, getStateLabel,
} from '../config/countriesStates.js';
import { searchCrops, normalizeCrop, CROP_OTHER, getCropLabel } from '../config/crops.js';
import { reverseGeocode } from '../lib/location/reverseGeocode.js';

const STAGE_OPTIONS = [
  'land_prep', 'planting', 'early_growth',
  'maintain', 'harvest', 'post_harvest',
];

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function NewFarmScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    saveProfile, switchFarm, refreshFarms, refreshProfile,
  } = useProfile();

  const [form, setForm] = useState({
    farmName: '',
    cropType: '',         // normalized code (e.g. 'maize'), or 'other'
    cropOther: '',        // free-form when cropType === 'other'
    cropQuery: '',        // search input string
    country: '',
    stateCode: '',
    size: '',
    sizeUnit: 'ACRE',
    stage: 'land_prep',
    // Farm type tier — tiers downstream experience (task engine,
    // alerts, recommendations). Defaults to small_farm per spec §4.
    farmType: 'small_farm',
    setActive: false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdFarm, setCreatedFarm] = useState(null);
  const [detectStatus, setDetectStatus] = useState('idle'); // idle | detecting | ok | failed

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear this field's error as the user edits it.
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }

  function handleCountryChange(e) {
    update('country', e.target.value);
    update('stateCode', ''); // reset state when country changes
  }

  // ─── Crop search + selection ──────────────────────────────
  const cropSuggestions = useMemo(() => {
    return searchCrops(form.cropQuery, { limit: 12 });
  }, [form.cropQuery]);

  function pickCrop(code) {
    setForm((prev) => ({
      ...prev,
      cropType: code,
      cropQuery: code === CROP_OTHER ? prev.cropQuery : getCropLabel(code),
    }));
    if (errors.cropType) setErrors((e) => ({ ...e, cropType: null }));
  }

  // ─── Detect location ──────────────────────────────────────
  async function handleDetectLocation() {
    if (detectStatus === 'detecting') return;
    setDetectStatus('detecting');
    const hasGeo = typeof navigator !== 'undefined' && navigator.geolocation;
    if (!hasGeo) { setDetectStatus('failed'); return; }
    try {
      const coords = await new Promise((resolve2, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 7000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(timer); resolve2(p); },
          (err) => { clearTimeout(timer); reject(err); },
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 5 * 60 * 1000 },
        );
      });
      const region = await reverseGeocode(
        coords?.coords?.latitude, coords?.coords?.longitude,
      );
      if (!region?.country) { setDetectStatus('failed'); return; }
      setForm((prev) => ({
        ...prev,
        country: region.country,
        stateCode: region.stateCode || '',
      }));
      setDetectStatus('ok');
    } catch {
      setDetectStatus('failed');
    }
  }

  // ─── Validation ───────────────────────────────────────────
  function validate() {
    const next = {};
    const resolvedCropCode = form.cropType === CROP_OTHER
      ? normalizeCrop(form.cropOther)
      : form.cropType;
    if (!form.country.trim()) {
      next.country = resolve(t, 'farm.newFarm.countryRequired',
        'Country is required to create a farm.');
    }
    if (!resolvedCropCode) {
      next.cropType = resolve(t, 'farm.newFarm.cropRequired',
        'Pick a crop or choose "Other" and name one.');
    }
    const sizeNum = Number(form.size);
    if (!form.size || !Number.isFinite(sizeNum) || sizeNum <= 0) {
      next.size = resolve(t, 'farm.newFarm.sizeRequired',
        'Farm size is required and must be greater than zero.');
    }
    return { errors: next, cropCode: resolvedCropCode };
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    if (saving) return;
    const { errors: fieldErrors, cropCode } = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setSubmitError('');
      return;
    }
    setErrors({});
    setSubmitError('');
    setSaving(true);
    try {
      const payload = {
        farmName:  form.farmName.trim() || 'My New Farm',
        cropType:  cropCode.toUpperCase(),
        country:   form.country.trim(),
        stateCode: form.stateCode.trim() || undefined,
        size:      Number(form.size),
        sizeUnit:  form.sizeUnit,
        cropStage: form.stage || 'land_prep',
        newFarm: true,
      };
      const result = await saveProfile(payload);
      setCreatedFarm(result?.profile || null);
      // Offline-first mirror — full normalized shape (spec §1 "Stored
      // farm object must be normalized" with code + label pairs).
      const localFarm = farrowaySaveFarm({
        name:         payload.farmName,
        crop:         cropCode,
        cropLabel:    form.cropType === CROP_OTHER
                        ? (form.cropOther.trim() || 'Other')
                        : getCropLabel(cropCode),
        country:      payload.country,
        countryLabel: getCountryLabel(payload.country),
        state:        payload.stateCode || null,
        stateLabel:   payload.stateCode
                        ? getStateLabel(payload.country, payload.stateCode)
                        : null,
        farmSize:     payload.size,
        sizeUnit:     payload.sizeUnit,
        stage:        payload.cropStage,
        farmType:     form.farmType,
        setActive:    !!form.setActive,
      });
      if (form.setActive && localFarm?.id) {
        farrowaySetActiveFarmId(localFarm.id);
      }
      safeTrackEvent('farm.new_farm_created', {
        farmId: result?.profile?.id || null,
        crop: cropCode || null,
      });
    } catch (err) {
      setSubmitError(err?.message
        || resolve(t, 'farm.newFarm.saveFailed', 'Could not create the new farm.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitchToNew() {
    if (!createdFarm?.id) { navigate('/my-farm'); return; }
    try {
      await switchFarm(createdFarm.id);
      farrowaySetActiveFarmId(createdFarm.id);
      try {
        if (typeof refreshProfile === 'function') await refreshProfile();
        if (typeof refreshFarms === 'function')   await refreshFarms();
      } catch { /* non-blocking */ }
      navigate('/my-farm');
    } catch {
      farrowaySetActiveFarmId(createdFarm.id);
      navigate('/my-farm');
    }
  }

  function handleStayOnCurrent() { navigate('/my-farm'); }
  function handleCancel()        { navigate('/my-farm'); }

  // Back button — returns via browser history when we have one
  // (covers "came here from FarmsList"), falls back to /my-farm
  // otherwise. If the user has started typing, confirm before
  // discarding so an accidental back tap doesn't wipe their work.
  function handleBack() {
    const dirty =
      (form.farmName && form.farmName.trim()) ||
      (form.cropType && form.cropType.trim()) ||
      (form.country && form.country.trim()) ||
      (form.size && String(form.size).trim()) ||
      (form.stateCode && form.stateCode.trim());
    if (dirty) {
      const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('You have unsaved changes. Go back and discard them?')
        : true;
      if (!ok) return;
    }
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/my-farm');
    }
  }

  // ─── Success state ──────────────────────────────────────
  if (createdFarm) {
    return (
      <main style={S.page} data-screen="new-farm" data-state="saved">
        <h1 style={S.title}>
          {resolve(t, 'farm.newFarm.successTitle', 'New farm created')}
        </h1>
        <p style={S.success} data-testid="new-farm-success">
          {'\u2714'} {resolve(t, 'farm.newFarm.successMessage',
            'Saved. Your farm is ready to use.')}
        </p>
        <p style={S.helper}>
          {resolve(t, 'farm.newFarm.successHelper',
            'Would you like to switch to this new farm now?')}
        </p>
        <div style={S.buttons}>
          <button
            type="button"
            onClick={handleSwitchToNew}
            style={S.saveBtn}
            data-testid="new-farm-switch-to"
          >
            {resolve(t, 'farm.newFarm.switchToThis', 'Switch to this farm')}
          </button>
          <button
            type="button"
            onClick={handleStayOnCurrent}
            style={S.cancelBtn}
            data-testid="new-farm-stay-on-current"
          >
            {resolve(t, 'farm.newFarm.stayOnCurrent', 'Stay on current farm')}
          </button>
        </div>
      </main>
    );
  }

  // ─── Form state ─────────────────────────────────────────
  const countryStates = getStatesForCountry(form.country);
  const showStates = hasStatesForCountry(form.country);

  return (
    <main style={S.page} data-screen="new-farm" data-state="form">
      {/* Back button — first thing in reading order so users on
          mobile can return without hunting for browser chrome. */}
      <button
        type="button"
        onClick={handleBack}
        style={S.backBtn}
        data-testid="new-farm-back"
        aria-label={resolve(t, 'common.back', 'Back')}
      >
        <span aria-hidden="true" style={{ fontSize: '1.05rem', lineHeight: 1 }}>
          {'\u2190'}
        </span>
        <span>{resolve(t, 'common.back', 'Back')}</span>
      </button>
      <h1 style={S.title}>{resolve(t, 'farm.newFarm.title', 'Add New Farm')}</h1>
      <p style={S.helper}>
        {resolve(t, 'farm.newFarm.helper',
          'Create another farm without affecting your current one.')}
      </p>

      <form onSubmit={handleSave} style={S.form} noValidate>
        {/* Farm name */}
        <label style={S.label}>
          {resolve(t, 'setup.farmName', 'Farm name')}
          <input
            type="text"
            value={form.farmName}
            onChange={(e) => update('farmName', e.target.value)}
            style={S.input}
            placeholder={resolve(t, 'farm.newFarm.farmNamePlaceholder', 'Optional')}
            data-testid="new-farm-name"
          />
        </label>

        {/* Crop — searchable + common list + Other */}
        <label style={S.label}>
          {resolve(t, 'setup.mainCrop', 'Main crop')}{' *'}
          <input
            type="text"
            value={form.cropQuery}
            onChange={(e) => setForm((p) => ({ ...p, cropQuery: e.target.value, cropType: '' }))}
            placeholder={resolve(t, 'farm.newFarm.cropSearchPlaceholder',
              'Search common crops…')}
            style={{
              ...S.input,
              ...(errors.cropType ? S.inputError : null),
            }}
            data-testid="new-farm-crop-search"
            aria-invalid={!!errors.cropType}
          />
          <div style={S.chipRow} data-testid="new-farm-crop-suggestions">
            {cropSuggestions.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pickCrop(c.code)}
                style={{
                  ...S.chip,
                  ...(form.cropType === c.code ? S.chipActive : null),
                }}
                data-testid={`new-farm-crop-${c.code}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {form.cropType === CROP_OTHER && (
            <input
              type="text"
              value={form.cropOther}
              onChange={(e) => update('cropOther', e.target.value)}
              placeholder={resolve(t, 'farm.newFarm.cropOtherPlaceholder',
                'Name the crop')}
              style={{ ...S.input, marginTop: '0.375rem' }}
              data-testid="new-farm-crop-other"
            />
          )}
          {errors.cropType && (
            <span style={S.fieldError} data-testid="new-farm-crop-error">
              {errors.cropType}
            </span>
          )}
        </label>

        {/* Country */}
        <label style={S.label}>
          {resolve(t, 'setup.country', 'Country')}{' *'}
          <select
            className="form-select"
            value={form.country}
            onChange={handleCountryChange}
            style={{
              ...S.select,
              ...(errors.country ? S.inputError : null),
            }}
            data-testid="new-farm-country"
            aria-invalid={!!errors.country}
          >
            <option value="">{resolve(t, 'setup.selectCountry', 'Select a country')}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          {errors.country && (
            <span style={S.fieldError} data-testid="new-farm-country-error">
              {errors.country}
            </span>
          )}
        </label>

        {/* State / region — only for countries with subdivisions */}
        {showStates && (
          <label style={S.label}>
            {resolve(t, 'setup.state', 'State / Region')}
            <select
              className="form-select"
              value={form.stateCode}
              onChange={(e) => update('stateCode', e.target.value)}
              style={S.select}
              data-testid="new-farm-state"
            >
              <option value="">{resolve(t, 'setup.selectState', 'Select a region')}</option>
              {countryStates.map((s) => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          </label>
        )}

        {/* Detect my location */}
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={detectStatus === 'detecting'}
          style={S.detectBtn}
          data-testid="new-farm-detect"
        >
          {detectStatus === 'detecting'
            ? resolve(t, 'detecting_location', 'Detecting…')
            : resolve(t, 'detect_location', 'Detect my location')}
        </button>
        {detectStatus === 'ok' && (
          <span style={S.detectOk} data-testid="new-farm-detect-ok">
            {resolve(t, 'location_detected', 'Location detected')}
          </span>
        )}
        {detectStatus === 'failed' && (
          <span style={S.detectFail} data-testid="new-farm-detect-failed">
            {resolve(t, 'location_detection_failed', "Couldn't detect location. Pick manually.")}
          </span>
        )}

        {/* Farm type — tier selector. Drives downstream task engine
            + alert verbosity via src/lib/farm/farmTypeBehavior.js.
            Sits directly above Farm Size per spec §3. */}
        <label style={S.label}>
          {resolve(t, 'setup.farmType', 'Farm type')}{' *'}
          <div style={S.chipRow} data-testid="new-farm-type-row">
            {[
              { code: 'backyard',   label: resolve(t, 'setup.farmType.backyard',   'Backyard / Home') },
              { code: 'small_farm', label: resolve(t, 'setup.farmType.small_farm', 'Small Farm') },
              { code: 'commercial', label: resolve(t, 'setup.farmType.commercial', 'Commercial Farm') },
            ].map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => update('farmType', opt.code)}
                style={{
                  ...S.chip,
                  ...(form.farmType === opt.code ? S.chipActive : null),
                }}
                data-testid={`new-farm-type-${opt.code}`}
                aria-pressed={form.farmType === opt.code}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>

        {/* Size + unit */}
        <div style={S.row}>
          <label style={{ ...S.label, flex: 1 }}>
            {resolve(t, 'setup.farmSize', 'Farm size')}{' *'}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.size}
              onChange={(e) => update('size', e.target.value)}
              style={{
                ...S.input,
                ...(errors.size ? S.inputError : null),
              }}
              data-testid="new-farm-size"
              aria-invalid={!!errors.size}
            />
          </label>
          <label style={{ ...S.label, width: '8rem' }}>
            {resolve(t, 'setup.sizeUnit', 'Unit')}
            <select
              className="form-select"
              value={form.sizeUnit}
              onChange={(e) => update('sizeUnit', e.target.value)}
              style={S.select}
              data-testid="new-farm-size-unit"
            >
              <option value="ACRE">{resolve(t, 'setup.acres', 'Acres')}</option>
              <option value="HECTARE">{resolve(t, 'setup.hectares', 'Hectares')}</option>
            </select>
          </label>
        </div>
        {errors.size && (
          <span style={S.fieldError} data-testid="new-farm-size-error">
            {errors.size}
          </span>
        )}

        {/* Stage */}
        <label style={S.label}>
          {resolve(t, 'cropStage.label', 'Stage (optional)')}
          <select
            className="form-select"
            value={form.stage}
            onChange={(e) => update('stage', e.target.value)}
            style={S.select}
            data-testid="new-farm-stage"
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {resolve(t, `cropStage.${s}`, s.replace(/_/g, ' '))}
              </option>
            ))}
          </select>
        </label>

        {/* Set as active toggle */}
        <label style={S.toggleRow}>
          <input
            type="checkbox"
            checked={form.setActive}
            onChange={(e) => update('setActive', e.target.checked)}
            data-testid="new-farm-set-active"
          />
          <span>
            {resolve(t, 'farm.newFarm.setActive',
              'Set this as my active farm after saving')}
          </span>
        </label>

        {submitError && <p style={S.error} role="alert">{submitError}</p>}

        <div style={S.buttons}>
          <button
            type="button"
            onClick={handleCancel}
            style={S.cancelBtn}
            disabled={saving}
            data-testid="new-farm-cancel"
          >
            {resolve(t, 'common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }}
            disabled={saving}
            data-testid="new-farm-save"
          >
            {saving
              ? resolve(t, 'common.saving', 'Saving\u2026')
              : resolve(t, 'farm.newFarm.saveNewFarm', 'Save New Farm')}
          </button>
        </div>
      </form>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh', background: '#0B1D34', color: '#fff',
    padding: '1.25rem 1rem 2rem', maxWidth: '32rem', margin: '0 auto',
    boxSizing: 'border-box',
  },
  title:  { fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.25rem' },
  helper: { margin: '0 0 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' },
  success: {
    margin: '0 0 0.75rem', padding: '0.625rem 0.75rem', borderRadius: 10,
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)',
    color: '#86EFAC', fontSize: '0.9rem',
  },
  form:   { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:  {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600,
  },
  input:  {
    padding: '0.625rem 0.75rem', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)', color: '#fff',
    fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
  },
  // Dedicated <select> style — solid background so Windows Chromium
  // stops falling back to the OS white popup theme + explicit
  // colorScheme + appearance:none to hide the browser chevron
  // (replaced with an SVG so the control looks like a select). See
  // EditFarmScreen for the full rationale.
  select: {
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    colorScheme: 'dark',
    padding: '0.625rem 2.25rem 0.625rem 0.75rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    background: '#0F1F3A '
      + 'url("data:image/svg+xml;utf8,'
      + '<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22>'
      + '<path fill=%22none%22 stroke=%22%239FB3C8%22 stroke-width=%221.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M2 4l4 4 4-4%22/>'
      + '</svg>") '
      + 'no-repeat right 0.75rem center / 12px 12px',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: 44,
    width: '100%',
    cursor: 'pointer',
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 0.75rem', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.875rem', fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '0.5rem',
    minHeight: 40,
  },
  inputError: { borderColor: 'rgba(239,68,68,0.55)' },
  row:    { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' },
  error:  {
    padding: '0.625rem 0.75rem', borderRadius: 10,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: '0.875rem', margin: '0.25rem 0 0',
  },
  fieldError: {
    marginTop: '0.25rem',
    color: '#FCA5A5', fontSize: '0.75rem', fontWeight: 500,
  },
  chipRow: {
    display: 'flex', flexWrap: 'wrap', gap: '0.25rem',
    marginTop: '0.375rem',
  },
  chip: {
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', fontSize: '0.75rem', fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.14)',
    color: '#86EFAC',
  },
  detectBtn: {
    padding: '0.5rem 0.75rem', borderRadius: 10,
    border: '1px solid rgba(14,165,233,0.28)',
    background: 'rgba(14,165,233,0.08)', color: '#0EA5E9',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
  },
  detectOk: {
    marginTop: '0.25rem', color: '#86EFAC', fontSize: '0.75rem', fontWeight: 600,
  },
  detectFail: {
    marginTop: '0.25rem', color: '#FDE68A', fontSize: '0.75rem', fontWeight: 600,
  },
  toggleRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500,
    marginTop: '0.25rem',
  },
  buttons: { display: 'flex', gap: '0.75rem', marginTop: '1rem' },
  cancelBtn: {
    flex: 1, padding: '0.75rem', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
    color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    flex: 1, padding: '0.75rem', borderRadius: 12, border: 'none',
    background: '#22C55E', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
  },
};

// Helper export (used by tests).
export const _helpers = Object.freeze({ getCountryLabel, getStateLabel });
