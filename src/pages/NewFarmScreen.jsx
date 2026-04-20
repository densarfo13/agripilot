/**
 * NewFarmScreen — standalone "Add Another Farm" page.
 *
 * Deliberately separate from onboarding AND from the Edit
 * Farm screen:
 *   • no step shell, no onboarding copy
 *   • never modifies the current active farm until the user
 *     chooses "Switch to this farm"
 *   • creates a new farm record via ProfileContext.saveProfile
 *     with the newFarm flag
 *
 * Data flow:
 *   empty form → user fills fields → saveProfile({...payload, newFarm:true})
 *   → success → show { Switch to this farm | Stay on current farm }
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import {
  saveFarm as farrowaySaveFarm,
  setActiveFarmId as farrowaySetActiveFarmId,
} from '../store/farrowayLocal.js';

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
    profile, saveProfile, switchFarm, refreshFarms, refreshProfile,
  } = useProfile();

  const [form, setForm] = useState({
    farmName: '',
    cropType: '',
    country: '',
    stateCode: '',
    size: '',
    sizeUnit: 'ACRE',
    stage: 'land_prep',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdFarm, setCreatedFarm] = useState(null);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    if (saving) return;
    if (!form.country.trim()) {
      setError(resolve(t, 'farm.newFarm.countryRequired',
        'Country is required to create a farm.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        farmName:  form.farmName.trim() || 'My New Farm',
        cropType:  form.cropType.trim().toUpperCase() || undefined,
        country:   form.country.trim(),
        stateCode: form.stateCode.trim() || undefined,
        size:      form.size ? Number(form.size) : undefined,
        sizeUnit:  form.sizeUnit,
        cropStage: form.stage || 'land_prep',
        // Critical: signals saveProfile to CREATE a new farm rather
        // than update the current one. Prevents overwrite bugs.
        newFarm: true,
      };
      const result = await saveProfile(payload);
      setCreatedFarm(result?.profile || null);
      // Offline-first mirror to farroway.farms so the farm survives
      // even if the backend write fails or we're offline.
      farrowaySaveFarm({
        name:     payload.farmName,
        crop:     payload.cropType || '',
        location: [payload.country, payload.stateCode].filter(Boolean).join(', '),
        size:     payload.size ? `${payload.size} ${payload.sizeUnit || ''}`.trim() : '',
      });
      safeTrackEvent('farm.new_farm_created', {
        farmId: result?.profile?.id || null,
        crop: payload.cropType || null,
      });
    } catch (err) {
      setError(err?.message
        || resolve(t, 'farm.newFarm.saveFailed', 'Could not create the new farm.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitchToNew() {
    if (!createdFarm?.id) {
      navigate('/my-farm');
      return;
    }
    try {
      await switchFarm(createdFarm.id);
      // Mirror active-farm selection to the farroway-local store so
      // offline reads agree with the server/profile-context selection.
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

  function handleStayOnCurrent() {
    navigate('/my-farm');
  }

  function handleCancel() {
    navigate('/my-farm');
  }

  // ─── Success state ──────────────────────────────────────
  if (createdFarm) {
    return (
      <main style={S.page} data-screen="new-farm" data-state="saved">
        <h1 style={S.title}>
          {resolve(t, 'farm.newFarm.successTitle', 'New farm created')}
        </h1>
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
  return (
    <main style={S.page} data-screen="new-farm" data-state="form">
      <h1 style={S.title}>{resolve(t, 'farm.newFarm.title', 'Add New Farm')}</h1>
      <p style={S.helper}>
        {resolve(t, 'farm.newFarm.helper',
          'Create another farm without affecting your current one.')}
      </p>

      <form onSubmit={handleSave} style={S.form}>
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

        <label style={S.label}>
          {resolve(t, 'setup.mainCrop', 'Crop')}
          <input
            type="text"
            value={form.cropType}
            onChange={(e) => update('cropType', e.target.value)}
            style={S.input}
            data-testid="new-farm-crop"
          />
        </label>

        <label style={S.label}>
          {resolve(t, 'setup.country', 'Country')}
          <input
            type="text"
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            style={S.input}
            required
            data-testid="new-farm-country"
          />
        </label>

        <label style={S.label}>
          {resolve(t, 'setup.state', 'State / Region (optional)')}
          <input
            type="text"
            value={form.stateCode}
            onChange={(e) => update('stateCode', e.target.value)}
            style={S.input}
            data-testid="new-farm-state"
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
              data-testid="new-farm-size"
            />
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
            value={form.stage}
            onChange={(e) => update('stage', e.target.value)}
            style={S.input}
            data-testid="new-farm-stage"
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {resolve(t, `cropStage.${s}`, s.replace(/_/g, ' '))}
              </option>
            ))}
          </select>
        </label>

        {error && <p style={S.error} role="alert">{error}</p>}

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
  row:    { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' },
  error:  {
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
