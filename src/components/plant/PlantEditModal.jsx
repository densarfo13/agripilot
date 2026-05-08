/**
 * PlantEditModal — compact bottom-sheet form for editing the
 * single active plant identity in Garden Mode.
 *
 *   <PlantEditModal open={open} onClose={() => setOpen(false)} />
 *
 * Fields (all optional — fallback nickname is "My Plant"):
 *   • nickname
 *   • plantType         (slug — drives intelligence engine)
 *   • indoorOutdoor     (indoor / outdoor)
 *   • containerType     (pot / raisedBed / ground / balcony / window)
 *   • containerSize     (small / medium / large)
 *   • growthStage       (seedling / growing / flowering / fruiting / ready_to_pick / resting)
 *
 * Save → calls usePlantIdentity().save(partial) which persists to
 * farroway_plant_v1 and emits farroway:plant_changed (and on first
 * meaningful stamp, farroway:plant_added — picked up by the timeline
 * bridge for the 'added' milestone).
 *
 * Strict-rule audit
 *   • All hooks declared unconditionally.
 *   • Never throws — every save call wrapped.
 *   • Inline styles only — no CSS module dependency.
 *   • Auto-focuses nickname on open for keyboard-friendly entry.
 *   • Esc closes; click on backdrop closes.
 *   • Localized via tSafe + useStrictTranslation; safe English fallbacks.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { useStrictTranslation } from '../../i18n/useStrictTranslation.js';
import usePlantIdentity from '../../hooks/usePlantIdentity.js';
import { compressImageFile } from '../../lib/plant/photoUpload.js';
import useRegionPreference from '../../hooks/useRegionPreference.js';

// ─── Enum option lists ────────────────────────────────────────────

const PLANT_TYPES = Object.freeze([
  // Slug + display fallback. UI prefers the localized crop name
  // when the cropNames overlay has it; falls back to the value below.
  { slug: 'tomato',   label: 'Tomato' },
  { slug: 'pepper',   label: 'Pepper' },
  { slug: 'basil',    label: 'Basil' },
  { slug: 'lettuce',  label: 'Lettuce' },
  { slug: 'spinach',  label: 'Spinach' },
  { slug: 'okra',     label: 'Okra' },
  { slug: 'maize',    label: 'Maize' },
  { slug: 'cassava',  label: 'Cassava' },
  { slug: 'onion',    label: 'Onion' },
  { slug: 'cabbage',  label: 'Cabbage' },
]);

const CONTAINER_TYPES = Object.freeze([
  { value: 'pot',         labelKey: 'plant.container.pot',        fallback: 'Pot' },
  { value: 'raisedBed',   labelKey: 'plant.container.raisedBed',  fallback: 'Raised bed' },
  { value: 'balcony',     labelKey: 'plant.container.balcony',    fallback: 'Balcony planter' },
  { value: 'window',      labelKey: 'plant.container.window',     fallback: 'Window box' },
  { value: 'ground',      labelKey: 'plant.container.ground',     fallback: 'Ground' },
]);

const CONTAINER_SIZES = Object.freeze([
  { value: 'small',  labelKey: 'plant.size.small',  fallback: 'Small' },
  { value: 'medium', labelKey: 'plant.size.medium', fallback: 'Medium' },
  { value: 'large',  labelKey: 'plant.size.large',  fallback: 'Large' },
]);

const GROWTH_STAGES = Object.freeze([
  { value: 'seedling',      labelKey: 'plant.stage.seedling',      fallback: 'Seedling' },
  { value: 'growing',       labelKey: 'plant.stage.growing',       fallback: 'Growing' },
  { value: 'flowering',     labelKey: 'plant.stage.flowering',     fallback: 'Flowering' },
  { value: 'fruiting',      labelKey: 'plant.stage.fruiting',      fallback: 'Fruiting' },
  { value: 'ready_to_pick', labelKey: 'plant.stage.readyToPick',   fallback: 'Ready to pick' },
  { value: 'resting',       labelKey: 'plant.stage.resting',       fallback: 'Resting' },
]);

const INDOOR_OPTIONS = Object.freeze([
  { value: 'indoor',  labelKey: 'plant.indoor.indoor',  fallback: 'Indoor' },
  { value: 'outdoor', labelKey: 'plant.indoor.outdoor', fallback: 'Outdoor' },
]);

// ─── Component ────────────────────────────────────────────────────

export default function PlantEditModal({ open = false, onClose }) {
  useStrictTranslation();
  const { plant, save } = usePlantIdentity();
  // Region awareness — when the user has set a country override
  // (or a known country flows through detection), the regional
  // common-crops list goes to the top of the plant picker so the
  // dropdown matches what's actually grown locally.
  const { regionContext } = useRegionPreference();

  // Build a region-aware plant-type list:
  //   • "Suggested for your region" group  → regionContext.commonCrops
  //     intersected with the canonical PLANT_TYPES catalog
  //   • "All plants" group                 → remaining catalog entries
  // When the region is unknown, the regional group is empty and the
  // dropdown falls back to the original alphabetical list.
  const plantTypeGroups = useMemo(() => {
    try {
      const all = PLANT_TYPES;
      const regional = (regionContext && Array.isArray(regionContext.commonCrops))
        ? regionContext.commonCrops : [];
      const regionalSet = new Set(regional);
      const inRegion = all.filter((p) => regionalSet.has(p.slug));
      // Sort the regional group by the order they appear in
      // regionContext.commonCrops so the most-common-locally crop
      // surfaces first.
      inRegion.sort((a, b) => regional.indexOf(a.slug) - regional.indexOf(b.slug));
      const others   = all.filter((p) => !regionalSet.has(p.slug));
      return { regional: inRegion, others };
    } catch {
      return { regional: [], others: PLANT_TYPES };
    }
  }, [regionContext]);

  // Local form state — initialized from the persisted plant on open.
  const [draft, setDraft] = useState(() => _draftFromPlant(plant));
  const [saving, setSaving] = useState(false);
  const nicknameRef = useRef(null);

  // Reset draft on open (so reopening discards in-flight edits if
  // the user closed without saving).
  useEffect(() => {
    if (open) {
      setDraft(_draftFromPlant(plant));
      // Auto-focus nickname for keyboard-first flow.
      try { setTimeout(() => nicknameRef.current?.focus(), 60); }
      catch { /* swallow */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e && e.key === 'Escape' && typeof onClose === 'function') onClose();
    };
    try { window.addEventListener('keydown', onKey); }
    catch { /* swallow */ }
    return () => {
      try { window.removeEventListener('keydown', onKey); }
      catch { /* swallow */ }
    };
  }, [open, onClose]);

  // Photo upload state — local, not persisted until Save.
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const fileInputRef = useRef(null);

  // Photo handler — runs the source File through canvas-resize +
  // JPEG-compress (no external deps); rejects oversized / wrong-type
  // files via null return. Sets photoError so the user sees what
  // went wrong instead of a silent no-op.
  const handlePhotoFile = useCallback(async (file) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const dataUrl = await compressImageFile(file, { maxDim: 800, quality: 0.82 });
      if (!dataUrl) {
        setPhotoError('compress-failed');
      } else {
        setDraft((prev) => ({ ...prev, photo: dataUrl }));
      }
    } catch {
      setPhotoError('compress-failed');
    } finally {
      setPhotoBusy(false);
    }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setDraft((prev) => ({ ...prev, photo: null }));
    setPhotoError(null);
    // Clear the file input so re-selecting the same file fires onChange.
    try { if (fileInputRef.current) fileInputRef.current.value = ''; }
    catch { /* swallow */ }
  }, []);

  if (!open) return null;

  function update(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      save({
        nickname:      draft.nickname || null,
        plantType:     draft.plantType || null,
        photo:         draft.photo         || null,
        indoorOutdoor: draft.indoorOutdoor || null,
        containerType: draft.containerType || null,
        containerSize: draft.containerSize || null,
        growthStage:   draft.growthStage || null,
      });
    } catch { /* never crash the modal */ }
    setSaving(false);
    if (typeof onClose === 'function') {
      try { onClose(); } catch { /* swallow */ }
    }
  }

  return (
    <div
      style={S.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && typeof onClose === 'function') onClose();
      }}
      data-testid="plant-edit-modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plant-edit-modal-title"
        style={S.sheet}
        data-testid="plant-edit-modal"
      >
        <header style={S.head}>
          <h2 id="plant-edit-modal-title" style={S.title}>
            {tSafe('plant.modal.title', 'Edit your plant')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={S.closeBtn}
            aria-label={tSafe('common.close', 'Close')}
            data-testid="plant-edit-modal-close"
          >
            ✕
          </button>
        </header>

        <div style={S.body}>
          {/* Photo — circular preview + Change/Remove buttons.
              Hidden file input is triggered by the visible "Change"
              button so the picker UX stays consistent across
              browsers. Compression runs on a worker-friendly canvas;
              no external image libraries required. */}
          <div style={S.photoRow} data-testid="plant-edit-photo-row">
            <div style={S.photoPreview}>
              {draft.photo ? (
                <img
                  src={draft.photo}
                  alt={tSafe('plant.field.photo.alt', 'Plant photo')}
                  style={S.photoImg}
                  draggable="false"
                  data-testid="plant-edit-photo-img"
                />
              ) : (
                <span style={S.photoEmpty} aria-hidden="true">🌿</span>
              )}
            </div>
            <div style={S.photoActions}>
              <span style={S.label}>{tSafe('plant.field.photo', 'Plant photo')}</span>
              <div style={S.photoBtnRow}>
                <button
                  type="button"
                  style={photoBusy ? { ...S.photoBtn, ...S.photoBtnBusy } : S.photoBtn}
                  onClick={() => {
                    try { fileInputRef.current?.click(); } catch { /* swallow */ }
                  }}
                  disabled={photoBusy}
                  data-testid="plant-edit-photo-change"
                >
                  {photoBusy
                    ? tSafe('plant.field.photo.busy',   'Resizing…')
                    : (draft.photo
                        ? tSafe('plant.field.photo.change', 'Change')
                        : tSafe('plant.field.photo.add',    'Add photo'))}
                </button>
                {draft.photo ? (
                  <button
                    type="button"
                    style={S.photoRemoveBtn}
                    onClick={handleRemovePhoto}
                    data-testid="plant-edit-photo-remove"
                  >
                    {tSafe('plant.field.photo.remove', 'Remove')}
                  </button>
                ) : null}
              </div>
              {photoError ? (
                <p style={S.photoError} data-testid="plant-edit-photo-error">
                  {tSafe('plant.field.photo.error',
                    'Could not use that photo. Try a smaller image (under 12 MB).')}
                </p>
              ) : null}
              {/* Hidden picker — accepts common phone-camera formats.
                  capture="environment" hints mobile to open the rear camera. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e?.target?.files?.[0];
                  if (file) handlePhotoFile(file);
                }}
                style={S.fileInput}
                data-testid="plant-edit-photo-input"
              />
            </div>
          </div>

          {/* Nickname */}
          <label style={S.field}>
            <span style={S.label}>{tSafe('plant.field.nickname', 'Nickname')}</span>
            <input
              ref={nicknameRef}
              type="text"
              value={draft.nickname || ''}
              onChange={(e) => update('nickname', e.target.value)}
              placeholder={tSafe('plant.field.nickname.placeholder', 'Balcony Tomato')}
              maxLength={40}
              style={S.input}
              data-testid="plant-edit-nickname"
            />
          </label>

          {/* Plant type — region-aware. Crops common in the user's
              region are grouped at the top under "Suggested for your
              region"; the rest fall under "All plants". When the
              region is unknown the regional group is empty and the
              alphabetical list renders directly under the placeholder. */}
          <label style={S.field}>
            <span style={S.label}>{tSafe('plant.field.type', 'Plant type')}</span>
            <select
              value={draft.plantType || ''}
              onChange={(e) => update('plantType', e.target.value)}
              style={S.input}
              data-testid="plant-edit-type"
            >
              <option value="">{tSafe('common.unspecified', '— select —')}</option>
              {plantTypeGroups.regional.length > 0 ? (
                <optgroup
                  label={tSafe('plant.field.type.regional',
                    'Suggested for your region')}
                  data-testid="plant-edit-type-regional"
                >
                  {plantTypeGroups.regional.map((p) => (
                    <option key={'r-' + p.slug} value={p.slug}>
                      {tSafe('crop.' + p.slug, p.label)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {plantTypeGroups.regional.length > 0 ? (
                <optgroup
                  label={tSafe('plant.field.type.allPlants', 'All plants')}
                  data-testid="plant-edit-type-all"
                >
                  {plantTypeGroups.others.map((p) => (
                    <option key={'o-' + p.slug} value={p.slug}>
                      {tSafe('crop.' + p.slug, p.label)}
                    </option>
                  ))}
                </optgroup>
              ) : (
                // No regional split — render the flat catalog so the
                // markup stays clean for users without a country pick.
                plantTypeGroups.others.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {tSafe('crop.' + p.slug, p.label)}
                  </option>
                ))
              )}
            </select>
          </label>

          {/* Indoor / outdoor */}
          <label style={S.field}>
            <span style={S.label}>{tSafe('plant.field.indoor', 'Indoor or outdoor')}</span>
            <select
              value={draft.indoorOutdoor || ''}
              onChange={(e) => update('indoorOutdoor', e.target.value)}
              style={S.input}
              data-testid="plant-edit-indoor"
            >
              <option value="">{tSafe('common.unspecified', '— select —')}</option>
              {INDOOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{tSafe(o.labelKey, o.fallback)}</option>
              ))}
            </select>
          </label>

          {/* Container type */}
          <label style={S.field}>
            <span style={S.label}>{tSafe('plant.field.containerType', 'Container')}</span>
            <select
              value={draft.containerType || ''}
              onChange={(e) => update('containerType', e.target.value)}
              style={S.input}
              data-testid="plant-edit-container"
            >
              <option value="">{tSafe('common.unspecified', '— select —')}</option>
              {CONTAINER_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{tSafe(o.labelKey, o.fallback)}</option>
              ))}
            </select>
          </label>

          {/* Container size */}
          <label style={S.field}>
            <span style={S.label}>{tSafe('plant.field.containerSize', 'Container size')}</span>
            <select
              value={draft.containerSize || ''}
              onChange={(e) => update('containerSize', e.target.value)}
              style={S.input}
              data-testid="plant-edit-size"
            >
              <option value="">{tSafe('common.unspecified', '— select —')}</option>
              {CONTAINER_SIZES.map((o) => (
                <option key={o.value} value={o.value}>{tSafe(o.labelKey, o.fallback)}</option>
              ))}
            </select>
          </label>

          {/* Growth stage */}
          <label style={S.field}>
            <span style={S.label}>{tSafe('plant.field.stage', 'Growth stage')}</span>
            <select
              value={draft.growthStage || ''}
              onChange={(e) => update('growthStage', e.target.value)}
              style={S.input}
              data-testid="plant-edit-stage"
            >
              <option value="">{tSafe('common.unspecified', '— select —')}</option>
              {GROWTH_STAGES.map((o) => (
                <option key={o.value} value={o.value}>{tSafe(o.labelKey, o.fallback)}</option>
              ))}
            </select>
          </label>
        </div>

        <footer style={S.foot}>
          <button
            type="button"
            onClick={onClose}
            style={S.cancelBtn}
            data-testid="plant-edit-cancel"
          >
            {tSafe('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={saving ? { ...S.saveBtn, ...S.saveBtnBusy } : S.saveBtn}
            data-testid="plant-edit-save"
          >
            {tSafe('common.save', 'Save')}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function _draftFromPlant(plant) {
  return {
    nickname:      plant && plant.nickname && plant.nickname !== 'My Plant' ? plant.nickname : '',
    plantType:     plant?.plantType     || '',
    photo:         plant?.photo         || null,
    indoorOutdoor: plant?.indoorOutdoor || '',
    containerType: plant?.containerType || '',
    containerSize: plant?.containerSize || '',
    growthStage:   plant?.growthStage   || '',
  };
}

// ─── Styles ───────────────────────────────────────────────────────

const S = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(8,16,12,0.62)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000,
    animation: 'farroway-fade-in 200ms ease-out',
  },
  sheet: {
    width: '100%',
    maxWidth: '32rem',
    background: 'linear-gradient(180deg, #1A3128 0%, #163826 100%)',
    border:     '1px solid rgba(255,255,255,0.08)',
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
    boxShadow:  '0 -16px 40px rgba(0,0,0,0.40)',
    display:    'flex',
    flexDirection: 'column',
    maxHeight:  '92vh',
    overflow:   'hidden',
    color:      '#FFFFFF',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    animation:  'farroway-slide-up 220ms ease-out',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.1rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  title: { margin: 0, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.005em' },
  closeBtn: {
    appearance: 'none', border: 'none', background: 'transparent',
    color: 'rgba(255,255,255,0.65)', fontSize: '1.05rem',
    cursor: 'pointer', padding: '0.35rem 0.6rem',
    borderRadius: '8px',
  },
  body: {
    padding: '0.85rem 1.1rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  input: {
    appearance: 'none',
    fontFamily: 'inherit',
    fontSize: '0.9375rem',
    padding: '0.7rem 0.8rem',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    color: '#FFFFFF',
    minHeight: '44px',
  },
  foot: {
    display: 'flex',
    gap: '0.6rem',
    padding: '0.75rem 1.1rem 1rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  cancelBtn: {
    flex: '0 0 auto',
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.78)',
    padding: '0.7rem 1rem',
    borderRadius: '10px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    flex: '1 1 auto',
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#062714',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: '44px',
  },
  saveBtnBusy: { opacity: 0.6, cursor: 'not-allowed' },

  // ── Photo upload row ────────────────────────────────────────────
  photoRow: {
    display: 'flex',
    gap: '0.85rem',
    alignItems: 'center',
    paddingBottom: '0.6rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  photoPreview: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(255,255,255,0.10)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  photoEmpty: {
    fontSize: '1.6rem',
    lineHeight: 1,
    opacity: 0.55,
  },
  photoActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: '1 1 auto',
    minWidth: 0,
  },
  photoBtnRow: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  photoBtn: {
    appearance: 'none',
    border: '1px solid rgba(34,197,94,0.32)',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    padding: '0.45rem 0.8rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  photoBtnBusy: {
    opacity: 0.6,
    cursor: 'wait',
  },
  photoRemoveBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.65)',
    padding: '0.45rem 0.8rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  photoError: {
    margin: '0.1rem 0 0',
    fontSize: '0.72rem',
    color: '#FCA5A5',
    lineHeight: 1.4,
  },
  fileInput: {
    display: 'none',
  },
};

// Test surface
export const _internal = Object.freeze({
  PLANT_TYPES, CONTAINER_TYPES, CONTAINER_SIZES, GROWTH_STAGES, INDOOR_OPTIONS,
  _draftFromPlant,
});
