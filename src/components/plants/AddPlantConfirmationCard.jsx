/**
 * AddPlantConfirmationCard.jsx — "Add this plant to My Plants?"
 *
 *   <AddPlantConfirmationCard
 *     scanResult={result}
 *     onAdd={handler}
 *     onScanAgain={handler}
 *     onSaveForReview={handler}
 *   />
 *
 * What this is
 * ────────────
 *   Standalone confirmation card the spec calls for after a
 *   successful scan result. Caller mounts it under ScanResultCard
 *   (or wherever the scan flow lands). The card NEVER auto-adds
 *   — three explicit user actions only.
 *
 *   Composition note: this is a standalone component to avoid
 *   modifying the 1556-line ScanPage.jsx that recently had a
 *   critical bug fix landed. ScanPage wiring is the next sprint;
 *   in the meantime callers can mount this anywhere the scan
 *   result is shown.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe.
 *   • Caller-driven state — no direct profile or registry writes.
 *   • All copy via tSafe envelopes.
 *   • No camera-error wording.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
// Real Plant Image System — one component, 4-tier fallback.
import PlantImage from './PlantImage.jsx';
// Note: this UI layer DOES NOT import the plant DB directly
// (architecture layer rule: ui -> service is banned). The scan
// envelope is expected to already carry the enriched fields
// (plantName, scientificName, growType / category, confidence)
// after passing through the scan runtime's tagScanWithGrowType.

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _isFn  = (v) => typeof v === 'function';

const S = {
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(31,41,51,0.10)',
    borderRadius: 14,
    padding: '16px 16px 14px',
    margin: '12px 0',
    boxShadow: '0 1px 3px rgba(31,41,51,0.04)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    fontSize: 16, fontWeight: 800, color: '#1F2933',
    margin: '0 0 6px',
  },
  meta: {
    fontSize: 13, color: '#64748B', margin: '0 0 12px',
    lineHeight: 1.5,
  },
  metaRow: {
    display: 'flex', alignItems: 'baseline',
    gap: 8, marginBottom: 4,
  },
  metaLabel: {
    fontSize: 11, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    minWidth: 80,
  },
  metaValue: { fontSize: 14, color: '#1F2933' },
  actions: {
    display: 'flex', gap: 8, flexWrap: 'wrap',
    marginTop: 12,
  },
  btnPrimary: {
    appearance: 'none', border: 'none',
    background: '#16A34A', color: '#FFFFFF',
    padding: '10px 14px', borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', flex: '1 1 160px',
  },
  btnSecondary: {
    appearance: 'none',
    background: 'transparent',
    color: '#1F2933',
    border: '1px solid rgba(31,41,51,0.18)',
    padding: '10px 14px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', flex: '1 1 120px',
  },
};

export default function AddPlantConfirmationCard({
  scanResult,
  onAdd,
  onScanAgain,
  onSaveForReview,
}) {
  if (!_isObj(scanResult)) return null;
  // Read enriched fields written by the scan runtime; never reach
  // into the plant catalog from this UI layer.
  const name     = _str(scanResult.plantName)
                || _str(scanResult.commonName)
                || _str(scanResult.label)
                || tSafe('plant.confirm.unknownName', 'Unknown plant');
  const sciName  = _str(scanResult.scientificName);
  const category = _str(scanResult.growType) || _str(scanResult.category);
  const confidence = _num(scanResult.confidence);
  const healthStatus = _str(scanResult.confidence) === 'high' ? 'good'
                      : _str(scanResult.confidence) === 'medium' ? 'fair'
                      : _str(scanResult.confidence) === 'low' ? 'needs_review'
                      : '';
  // Gap-fix blocker 4 — Plant.id covers crops well but flowers /
  // houseplants / herbs often resolve to growType:'unknown'.
  // Surface a calm hint so the user can still proceed instead of
  // dead-ending. The actual category picker UI ships in a follow-
  // up; this hint at least signals the recovery path.
  const categoryUnknown = !category || category === 'unknown';

  // Real Plant Image System — pick the best signal available
  // from the scan envelope to seed the image. Resolver handles
  // the fallback to placeholder when nothing's present.
  const _plantImageId = (scanResult.plantId
    || (name || '').toLowerCase().replace(/\s+/g, '_'));
  const _scanImage = scanResult.thumbnail || scanResult.imageUrl;

  return (
    <section style={S.card} data-testid="add-plant-confirmation-card">
      <PlantImage
        plantId={_plantImageId}
        scanImage={_scanImage}
        alt={name}
        size="card"
        testid="add-plant-image"
        style={{ marginBottom: 12 }}
      />
      <h2 style={S.header}>
        {tSafe('plant.confirm.title', 'Add this plant to My Plants?')}
      </h2>

      <div style={S.meta}>
        <div style={S.metaRow}>
          <div style={S.metaLabel}>
            {tSafe('plant.confirm.name', 'Name')}
          </div>
          <div style={S.metaValue} data-testid="add-plant-name">{name}</div>
        </div>
        {sciName ? (
          <div style={S.metaRow}>
            <div style={S.metaLabel}>
              {tSafe('plant.confirm.scientific', 'Scientific')}
            </div>
            <div style={S.metaValue} data-testid="add-plant-sci">
              <em>{sciName}</em>
            </div>
          </div>
        ) : null}
        {category ? (
          <div style={S.metaRow}>
            <div style={S.metaLabel}>
              {tSafe('plant.confirm.category', 'Category')}
            </div>
            <div style={S.metaValue} data-testid="add-plant-category">
              {category}
            </div>
          </div>
        ) : null}
        {confidence != null ? (
          <div style={S.metaRow}>
            <div style={S.metaLabel}>
              {tSafe('plant.confirm.confidence', 'Confidence')}
            </div>
            <div style={S.metaValue} data-testid="add-plant-confidence">
              {Math.round(confidence * 100)}%
            </div>
          </div>
        ) : null}
        {healthStatus ? (
          <div style={S.metaRow}>
            <div style={S.metaLabel}>
              {tSafe('plant.confirm.health', 'Health')}
            </div>
            <div style={S.metaValue} data-testid="add-plant-health-status">
              {healthStatus === 'good'
                ? tSafe('plant.confirm.health.good', 'Looks good')
                : healthStatus === 'needs_review'
                ? tSafe('plant.confirm.health.needsReview', 'Needs review')
                : tSafe('plant.confirm.health.fair', 'Fair')}
            </div>
          </div>
        ) : null}
        {categoryUnknown ? (
          <div
            data-testid="add-plant-category-unknown-hint"
            style={{
              marginTop: 8, fontSize: 12, color: '#92400E',
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 8, padding: '8px 10px', lineHeight: 1.5,
            }}>
            {tSafe('plant.confirm.unknownCategory',
              'Plant identification was inconclusive. The plant '
              + 'will be added as "unknown" — you can update the '
              + 'category later from the plant profile.')}
          </div>
        ) : null}
      </div>

      <div style={S.actions}>
        <button
          type="button"
          style={S.btnPrimary}
          onClick={_isFn(onAdd) ? () => onAdd(scanResult) : undefined}
          disabled={!_isFn(onAdd)}
          data-testid="add-plant-confirm-add"
        >
          {tSafe('plant.confirm.add', 'Add to My Plants')}
        </button>
        <button
          type="button"
          style={S.btnSecondary}
          onClick={_isFn(onScanAgain) ? onScanAgain : undefined}
          disabled={!_isFn(onScanAgain)}
          data-testid="add-plant-confirm-scan-again"
        >
          {tSafe('plant.confirm.scanAgain', 'Scan again')}
        </button>
        <button
          type="button"
          style={S.btnSecondary}
          onClick={_isFn(onSaveForReview) ? onSaveForReview : undefined}
          disabled={!_isFn(onSaveForReview)}
          data-testid="add-plant-confirm-save-for-review"
        >
          {tSafe('plant.confirm.saveForReview', 'Save for review')}
        </button>
      </div>
    </section>
  );
}
