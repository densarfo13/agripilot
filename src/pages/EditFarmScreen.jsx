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
import { useNavigate } from 'react-router-dom';

import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import {
  farmToEditForm, editFormToPatch,
  hasAnyChange, validateEditForm,
  assertEditPatchHasNoOnboardingState,
  assertFarmWasUpdatedNotRecreated,
} from '../utils/editFarm/index.js';

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
  const { t } = useTranslation();
  const { profile, editFarm } = useProfile();

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

    setSaving(true);
    setSaveError('');
    try {
      const updated = await editFarm(profile.id, patch);
      // §10 dev assertion: confirm the server returned the SAME farm id.
      assertFarmWasUpdatedNotRecreated(profile.id, updated?.id);
      safeTrackEvent('farm.edit_saved', { farmId: profile.id, fields: Object.keys(patch) });
      navigate('/my-farm');
    } catch (err) {
      setSaveError(err?.message || resolve(t, 'farm.editFailed', 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate('/my-farm');
  }

  return (
    <main style={S.page} data-screen="edit-farm">
      <h1 style={S.title}>{resolve(t, 'farm.editFarm.title', 'Edit Farm')}</h1>
      <p style={S.helper}>
        {resolve(t, 'farm.editFarm.helper',
          'Change your farm details. This does not start onboarding over.')}
      </p>

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

        <label style={S.label}>
          {resolve(t, 'setup.mainCrop', 'Crop')}
          <input
            type="text"
            value={form.cropType}
            onChange={(e) => update('cropType', e.target.value)}
            style={S.input}
            data-testid="edit-farm-crop"
          />
        </label>

        <label style={S.label}>
          {resolve(t, 'setup.country', 'Country')}
          <input
            type="text"
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            style={S.input}
            data-testid="edit-farm-country"
          />
        </label>

        <label style={S.label}>
          {resolve(t, 'setup.location', 'Location (state or region)')}
          <input
            type="text"
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            style={S.input}
            data-testid="edit-farm-location"
          />
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
              value={form.sizeUnit}
              onChange={(e) => update('sizeUnit', e.target.value)}
              style={S.input}
            >
              <option value="ACRE">{resolve(t, 'setup.acres', 'Acres')}</option>
              <option value="HECTARE">{resolve(t, 'setup.hectares', 'Hectares')}</option>
            </select>
          </label>
        </div>

        <label style={S.label}>
          {resolve(t, 'cropStage.label', 'Stage (optional)')}
          <select
            value={form.cropStage}
            onChange={(e) => update('cropStage', e.target.value)}
            style={S.input}
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
  row: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' },
  fieldError: { color: '#FCA5A5', fontSize: '0.75rem' },
  error: {
    padding: '0.625rem 0.75rem', borderRadius: 10,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: '0.875rem', margin: '0.25rem 0 0',
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
