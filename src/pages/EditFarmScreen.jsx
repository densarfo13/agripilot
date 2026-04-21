/**
 * EditFarmScreen — standalone "change your farm details" page.
 *
 * This screen is DELIBERATELY separate from onboarding:
 *   • no step indicators
 *   • no "Step N of M" language
 *   • no multi-step navigation
 *   • no imports from src/pages/onboarding/* or src/utils/fastOnboarding/*
 *   • Save issues a PATCH — never a create — so onboarding
 *     state, farmerType, and progress are preserved
 *
 * Data flow:
 *   farm from ProfileContext → farmToEditForm → controlled inputs
 *   → editFormToPatch (diff only) → editFarm() PATCH
 *   → navigate('/my-farm') on success
 */

import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import {
  farmToEditForm, editFormToPatch,
  hasAnyChange, validateEditForm,
  classifyFarmChanges,
  buildRecomputeIntent, analyticsPayloadForChanges,
  assertEditPatchHasNoOnboardingState,
  assertFarmWasUpdatedNotRecreated,
  assertFarmerTypeNotMutated,
  assertRecomputeTriggered,
} from '../utils/editFarm/index.js';
import { getEditModeCopy } from '../utils/editFarm/editModeCopy.js';
import {
  COUNTRIES, getStatesForCountry, hasStatesForCountry,
} from '../config/countriesStates.js';
import {
  searchCrops, normalizeCrop, CROP_OTHER, getCropLabel,
} from '../config/crops.js';

const CROP_STAGES = [
  'planning', 'land_preparation', 'planting', 'germination',
  'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
];

const STAGE_KEYS = {
  planning: 'cropStage.planning',
  land_preparation: 'cropStage.landPreparation',
  planting: 'cropStage.planting',
  germination: 'cropStage.germination',
  vegetative: 'cropStage.vegetative',
  flowering: 'cropStage.flowering',
  fruiting: 'cropStage.fruiting',
  harvest: 'cropStage.harvest',
  post_harvest: 'cropStage.postHarvest',
};

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function EditFarmScreen() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { profile, editFarm, refreshFarms, refreshProfile } = useProfile();
  const [searchParams] = useSearchParams();
  // Mode flags from the query string. Supported values:
  //   • complete_profile           — routed from "Complete Profile"
  //   • complete_for_recommendation — routed from Find My Best Crop
  // The page still behaves as a plain edit form, but the header
  // copy adapts so the user knows WHY they're here.
  const editMode = searchParams.get('mode') || 'edit';

  // Snapshot the original farm at mount so change-detection is
  // stable while the user types (hasAnyChange compares to this).
  const originalRef = useRef(null);
  if (originalRef.current === null) {
    originalRef.current = profile || {};
  }
  const original = originalRef.current;

  const [form, setForm] = useState(() => farmToEditForm(original));
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Crop picker is structured: the user either clicks a chip (which
  // writes a normalized code to `form.cropType`) or picks "Other" and
  // names one (which writes a normalized code from `cropOther`).
  // Free-typed text alone is not accepted — it only filters the chip
  // list. These two pieces of local state stay out of the form + patch
  // because they're UI, not data.
  const initialCrop = (original.cropType || original.crop || '').toString().toLowerCase();
  const [cropQuery, setCropQuery] = useState(() => getCropLabel(initialCrop, lang));
  const [cropOther, setCropOther] = useState(
    () => (initialCrop && !getCropLabel(initialCrop, lang) ? initialCrop : ''),
  );
  // Brief "Farm updated — your guidance has been refreshed" flash
  // shown after a successful save, before navigating back to Home.
  const [successFlash, setSuccessFlash] = useState('');

  const patch = useMemo(() => editFormToPatch(form, original), [form, original]);
  const dirty = useMemo(() => hasAnyChange(form, original),   [form, original]);

  // No farm to edit → bounce to /my-farm. This should be rare;
  // ProfileGuard normally catches empty-profile cases earlier.
  if (!profile || !profile.id) {
    return (
      <main style={S.page} data-screen="edit-farm" data-empty="true">
        <h1 style={S.title}>{resolve(t, 'farm.editFarm.title', 'Edit Farm')}</h1>
        <p style={S.helper}>{resolve(t, 'farm.editFarm.noFarm',
          'You don\u2019t have a farm yet.')}</p>
        <div style={S.buttons}>
          <button type="button" onClick={() => navigate('/my-farm')} style={S.cancelBtn}>
            {resolve(t, 'common.back', 'Back')}
          </button>
        </div>
      </main>
    );
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
  }

  // Country change resets the dependent state dropdown so the user
  // never saves a stale subdivision code.
  function handleCountryChange(e) {
    setForm((prev) => ({ ...prev, country: e.target.value, stateCode: '' }));
    if (fieldErrors.country) {
      setFieldErrors((prev) => ({ ...prev, country: '' }));
    }
  }

  // Typing in the crop input FILTERS the list but also clears the
  // stored code — the user must pick a chip again (or "Other" and
  // supply a name). This is how we disallow free text.
  function handleCropQueryChange(e) {
    const next = e.target.value;
    setCropQuery(next);
    setForm((prev) => ({ ...prev, cropType: '' }));
    if (fieldErrors.cropType) {
      setFieldErrors((prev) => ({ ...prev, cropType: '' }));
    }
  }

  function pickCrop(code) {
    setForm((prev) => ({ ...prev, cropType: code }));
    if (code !== CROP_OTHER) {
      setCropQuery(getCropLabel(code, lang));
      setCropOther('');
    }
    if (fieldErrors.cropType) {
      setFieldErrors((prev) => ({ ...prev, cropType: '' }));
    }
  }

  function handleCropOtherChange(e) {
    const next = e.target.value;
    setCropOther(next);
    // While "Other" is selected, the stored code follows whatever
    // the user types, normalized. Clearing the input drops cropType
    // back to 'other' so validation still blocks save until named.
    const normalized = normalizeCrop(next);
    setForm((prev) => ({
      ...prev,
      cropType: normalized || CROP_OTHER,
    }));
  }

  const cropSuggestions = useMemo(() => {
    return searchCrops(cropQuery, { limit: 12 });
  }, [cropQuery]);

  async function handleSave(e) {
    e?.preventDefault?.();
    if (saving) return;

    const errs = validateEditForm(form);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    // Nothing to save — just go back quietly rather than hitting the API.
    if (!dirty) {
      navigate('/my-farm');
      return;
    }

    // §10 dev assertion: never ship onboarding keys in an edit patch.
    assertEditPatchHasNoOnboardingState(patch);

    // Classify WHAT changed so we can: log it, signal downstream
    // systems via intent descriptor, and fire only the refreshes
    // that are actually needed.
    const changes = classifyFarmChanges(form, original);
    const intent  = buildRecomputeIntent(changes);

    setSaving(true);
    setSaveError('');
    try {
      const updated = await editFarm(profile.id, patch);
      // §10 dev assertion: confirm the server returned the SAME farm id.
      assertFarmWasUpdatedNotRecreated(profile.id, updated?.id);
      // §13 dev assertion: farmerType must survive an edit.
      assertFarmerTypeNotMutated(original.farmerType, updated?.farmerType);

      // Belt-and-braces recompute triggers. editFarm already calls
      // refreshFarms() internally, but if caller code or server
      // latency left stale data, these make sure Home sees the
      // new profile. Each is a no-op if unavailable (older context).
      let didRefresh = false;
      try {
        if (typeof refreshProfile === 'function') await refreshProfile();
        if (typeof refreshFarms === 'function')   await refreshFarms();
        didRefresh = true;
      } catch { /* non-blocking — context will still re-render */ }
      // §13 dev assertion: any edit that should rebuild Home must
      // have fired a refresh. `didRefresh` answers "did we try?".
      assertRecomputeTriggered(intent, didRefresh);

      // Structured analytics — consumers can filter on change type.
      safeTrackEvent('farm.edit_saved', {
        farmId: profile.id,
        ...analyticsPayloadForChanges(changes, patch),
        recomputeRule: intent.rule,
      });

      // Brief success flash so the user sees confirmation before
      // the navigation flash (§9: "Farm updated — your guidance
      // has been refreshed"). ~900ms is enough to read without
      // feeling like a blocker.
      setSuccessFlash(resolve(t, 'farm.editFarm.saveSuccess',
        'Farm updated \u2014 your guidance has been refreshed'));
      setTimeout(() => {
        setSuccessFlash('');
        navigate('/my-farm');
      }, 900);
    } catch (err) {
      setSaveError(err?.message || resolve(t, 'farm.editFailed', 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate('/my-farm');
  }

  // Back button — returns to the previous page via browser history
  // when available (covers "I came here from /farms/123"), falls back
  // to the canonical farm dashboard otherwise. If the user has edited
  // fields, confirm before discarding so accidental back taps don't
  // wipe a long entry.
  function handleBack() {
    const dirty = hasAnyChange(form, originalRef.current || {});
    if (dirty) {
      const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(resolve(
            t,
            'farm.editFarm.discardConfirm',
            'You have unsaved changes. Go back and discard them?',
          ))
        : true;
      if (!ok) return;
    }
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/my-farm');
    }
  }

  // Mode-specific header derived from the pure helper; testable
  // without mounting React.
  const { titleKey, titleFallback, helperKey, helperFallback } = getEditModeCopy(editMode);

  return (
    <main style={S.page} data-screen="edit-farm" data-edit-mode={editMode}>
      {/* Top Back button — returns to the previous page, with an
          unsaved-changes guard. Sits above the title so it's the
          first thing in the reading order on both desktop and
          mobile. Keeps the bottom "Cancel" (which explicitly
          discards + returns to /my-farm) for users who want a clear
          "abandon changes" intent. */}
      <button
        type="button"
        onClick={handleBack}
        style={S.backBtn}
        data-testid="edit-farm-back"
        aria-label={resolve(t, 'common.back', 'Back')}
      >
        <span aria-hidden="true" style={{ fontSize: '1.05rem', lineHeight: 1 }}>
          {'\u2190'}
        </span>
        <span>{resolve(t, 'common.back', 'Back')}</span>
      </button>
      <h1 style={S.title}>{resolve(t, titleKey, titleFallback)}</h1>
      <p style={S.helper}>{resolve(t, helperKey, helperFallback)}</p>

      <form onSubmit={handleSave} style={S.form}>
        <label style={S.label}>
          {resolve(t, 'setup.farmName', 'Farm name')}
          <input
            type="text"
            value={form.farmName}
            onChange={(e) => update('farmName', e.target.value)}
            style={S.input}
            data-testid="edit-farm-name"
            required
          />
          {fieldErrors.farmName && <span style={S.fieldError}>
            {resolve(t, fieldErrors.farmName, 'Farm name is required')}
          </span>}
        </label>

        {/* Crop — searchable, chip-picked; free text is only for "Other". */}
        <label style={S.label}>
          {resolve(t, 'setup.mainCrop', 'Crop')}{' *'}
          <input
            type="text"
            value={cropQuery}
            onChange={handleCropQueryChange}
            placeholder={resolve(t, 'farm.editFarm.cropSearchPlaceholder',
              'Search common crops\u2026')}
            style={{
              ...S.input,
              ...(fieldErrors.cropType ? S.inputError : null),
            }}
            data-testid="edit-farm-crop"
            aria-invalid={!!fieldErrors.cropType}
          />
          <div style={S.chipRow} data-testid="edit-farm-crop-suggestions">
            {cropSuggestions.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pickCrop(c.code)}
                style={{
                  ...S.chip,
                  ...(form.cropType === c.code || (c.code === CROP_OTHER && form.cropType && !getCropLabel(form.cropType))
                    ? S.chipActive : null),
                }}
                data-testid={`edit-farm-crop-${c.code}`}
              >
                {/* Render the localised label — auto-updates when
                    the user flips the language toggle. */}
                {getCropLabel(c.code, lang)}
              </button>
            ))}
          </div>
          {form.cropType === CROP_OTHER && (
            <input
              type="text"
              value={cropOther}
              onChange={handleCropOtherChange}
              placeholder={resolve(t, 'farm.editFarm.cropOtherPlaceholder',
                'Name the crop')}
              style={{ ...S.input, marginTop: '0.375rem' }}
              data-testid="edit-farm-crop-other"
            />
          )}
          {fieldErrors.cropType && <span style={S.fieldError}>
            {resolve(t, fieldErrors.cropType,
              'Pick a crop or choose "Other" and name one.')}
          </span>}
        </label>

        {/* Country — dropdown bound to the curated list. */}
        <label style={S.label}>
          {resolve(t, 'setup.country', 'Country')}{' *'}
          <select
            className="form-select"
            value={form.country}
            onChange={handleCountryChange}
            style={{
              ...S.select,
              ...(fieldErrors.country ? S.inputError : null),
            }}
            data-testid="edit-farm-country"
            aria-invalid={!!fieldErrors.country}
          >
            <option value="">{resolve(t, 'setup.selectCountry', 'Select a country')}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          {fieldErrors.country && <span style={S.fieldError}>
            {resolve(t, fieldErrors.country, 'Country is required.')}
          </span>}
        </label>

        {/* State / region — dependent dropdown; hidden when the
            country has no curated subdivisions. */}
        {hasStatesForCountry(form.country) && (
          <label style={S.label}>
            {resolve(t, 'setup.state', 'State / Region')}
            <select
              className="form-select"
              value={form.stateCode}
              onChange={(e) => update('stateCode', e.target.value)}
              style={S.select}
              data-testid="edit-farm-state"
            >
              <option value="">{resolve(t, 'setup.selectState', 'Select a region')}</option>
              {getStatesForCountry(form.country).map((s) => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          </label>
        )}

        {/* Farm type tier — drives downstream behaviour via
            farmTypeBehavior.js. Renders above Farm Size per spec §3. */}
        <label style={S.label}>
          {resolve(t, 'setup.farmType', 'Farm type')}{' *'}
          <div style={S.chipRow} data-testid="edit-farm-type-row">
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
                data-testid={`edit-farm-type-${opt.code}`}
                aria-pressed={form.farmType === opt.code}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>

        <div style={S.row}>
          <label style={{ ...S.label, flex: 1 }}>
            {resolve(t, 'setup.farmSize', 'Farm size (optional)')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.size}
              onChange={(e) => update('size', e.target.value)}
              style={S.input}
              data-testid="edit-farm-size"
            />
            {fieldErrors.size && <span style={S.fieldError}>
              {resolve(t, fieldErrors.size, 'Size must be positive')}
            </span>}
          </label>
          <label style={{ ...S.label, width: '8rem' }}>
            {resolve(t, 'setup.sizeUnit', 'Unit')}
            <select
              className="form-select"
              value={form.sizeUnit}
              onChange={(e) => update('sizeUnit', e.target.value)}
              style={S.select}
            >
              <option value="ACRE">{resolve(t, 'setup.acres', 'Acres')}</option>
              <option value="HECTARE">{resolve(t, 'setup.hectares', 'Hectares')}</option>
            </select>
          </label>
        </div>

        <label style={S.label}>
          {resolve(t, 'cropStage.label', 'Stage (optional)')}
          <select
            className="form-select"
            value={form.cropStage}
            onChange={(e) => update('cropStage', e.target.value)}
            style={S.select}
            data-testid="edit-farm-stage"
          >
            {CROP_STAGES.map((s) => (
              <option key={s} value={s}>
                {resolve(t, STAGE_KEYS[s], s.replace(/_/g, ' '))}
              </option>
            ))}
          </select>
        </label>

        {saveError && <p style={S.error} role="alert">{saveError}</p>}
        {successFlash && (
          <p style={S.success} role="status" data-testid="edit-farm-success">
            {successFlash}
          </p>
        )}

        <div style={S.buttons}>
          <button
            type="button"
            onClick={handleCancel}
            style={S.cancelBtn}
            disabled={saving}
            data-testid="edit-farm-cancel"
          >
            {resolve(t, 'common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }}
            disabled={saving}
            data-testid="edit-farm-save"
          >
            {saving
              ? resolve(t, 'common.saving', 'Saving\u2026')
              : resolve(t, 'farm.editFarm.saveChanges', 'Save Changes')}
          </button>
        </div>
      </form>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '1.25rem 1rem 2rem',
    maxWidth: '32rem',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  title: {
    fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.25rem',
  },
  helper: {
    margin: '0 0 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label: {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600,
  },
  input: {
    padding: '0.625rem 0.75rem', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)', color: '#fff',
    fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
  },
  // Dedicated style for <select>. The generic `input` background is
  // semi-transparent, which on Windows Chromium triggers the native
  // dropdown's OS-theme fallback (white text on white popup). This
  // style uses a SOLID #0F1F3A background + colorScheme:'dark' so
  // both the closed control AND the expanded native popup stay
  // readable. A CSS chevron keeps the control looking like a select
  // after appearance:none strips the browser default arrow.
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
    minHeight: 44,                  // keeps tap targets comfortable
    width: '100%',                  // match the field width; stops the
                                    // browser giving selects intrinsic
                                    // text-content width (the "giant
                                    // menu" report when options are long)
    cursor: 'pointer',
  },
  row: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' },
  inputError: { borderColor: 'rgba(239,68,68,0.55)' },
  chipRow: {
    display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.375rem',
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
  fieldError: { color: '#FCA5A5', fontSize: '0.75rem' },
  error: {
    padding: '0.625rem 0.75rem', borderRadius: 10,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: '0.875rem', margin: '0.25rem 0 0',
  },
  success: {
    padding: '0.625rem 0.75rem', borderRadius: 10,
    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
    color: '#86EFAC', fontSize: '0.875rem', margin: '0.25rem 0 0',
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
