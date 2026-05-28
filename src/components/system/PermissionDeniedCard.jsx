/**
 * PermissionDeniedCard.jsx — calm UX for camera or location denial.
 *
 *   <PermissionDeniedCard
 *     kind="camera" | "location"
 *     onOpenSettings={() => …}
 *     onChoosePhoto={() => …}     // camera only
 *     onEnterManually={() => …}   // location only
 *     onRetry={() => …}
 *   />
 *
 * Strict-rule audit
 *   • Pure component. SSR-safe (no window access).
 *   • All copy is localized via tSafe; falls back to RC1 English.
 *   • Action handlers are caller-controlled — no direct nav or
 *     storage from this component.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const STYLES = {
  card: {
    background:    '#FFFFFF',
    border:        '1px solid rgba(31,41,51,0.10)',
    borderRadius:  14,
    padding:       '20px 18px',
    margin:        '12px auto',
    maxWidth:      420,
    boxShadow:     '0 1px 2px rgba(31,41,51,0.04)',
  },
  title: {
    margin:        0,
    fontSize:      16,
    fontWeight:    700,
    color:         '#1F2933',
    marginBottom:  8,
  },
  body: {
    margin:        0,
    fontSize:      14,
    lineHeight:    1.5,
    color:         '#475569',
    marginBottom:  16,
  },
  row: {
    display:       'flex',
    gap:           8,
    flexWrap:      'wrap',
  },
  btnPrimary: {
    appearance:    'none',
    border:        'none',
    background:    '#C8944D',
    color:         '#FFFFFF',
    fontWeight:    600,
    padding:       '10px 14px',
    borderRadius:  10,
    cursor:        'pointer',
    fontFamily:    'inherit',
  },
  btnSecondary: {
    appearance:    'none',
    border:        '1px solid rgba(31,41,51,0.18)',
    background:    'transparent',
    color:         '#1F2933',
    fontWeight:    600,
    padding:       '10px 14px',
    borderRadius:  10,
    cursor:        'pointer',
    fontFamily:    'inherit',
  },
};

const _isFn = (v) => typeof v === 'function';

export default function PermissionDeniedCard({
  kind = 'camera',
  onOpenSettings,
  onChoosePhoto,
  onEnterManually,
  onRetry,
}) {
  const isCamera = kind === 'camera';
  const titleKey   = isCamera ? 'rc1.permission.camera.title'
                              : 'rc1.permission.location.title';
  const titleDefault = isCamera ? 'Camera access is off'
                                : 'Location access is off';
  const bodyKey   = isCamera ? 'rc1.permission.camera.body'
                             : 'rc1.permission.location.body';
  const bodyDefault = isCamera
    ? 'Turn on camera access in your phone settings so Farroway can scan your crop.'
    : 'Turn on location access for local weather and region-specific crop guidance, or continue with manual location.';

  const openSettingsLabel = tSafe('rc1.permission.openSettings', 'Open Settings');
  const choosePhotoLabel  = tSafe('rc1.permission.choosePhoto',  'Choose photo instead');
  const enterManuallyLabel = tSafe('rc1.permission.enterManually', 'Enter location manually');
  const retryLabel        = tSafe('rc1.permission.retry',        'Try again');

  return (
    <section
      style={STYLES.card}
      data-testid={`permission-denied-${kind}`}
      role="region"
      aria-label={tSafe(titleKey, titleDefault)}
    >
      <h3 style={STYLES.title}>{tSafe(titleKey, titleDefault)}</h3>
      <p style={STYLES.body}>{tSafe(bodyKey, bodyDefault)}</p>
      <div style={STYLES.row}>
        {_isFn(onOpenSettings) && (
          <button type="button" style={STYLES.btnPrimary} onClick={onOpenSettings}>
            {openSettingsLabel}
          </button>
        )}
        {isCamera && _isFn(onChoosePhoto) && (
          <button type="button" style={STYLES.btnSecondary} onClick={onChoosePhoto}>
            {choosePhotoLabel}
          </button>
        )}
        {!isCamera && _isFn(onEnterManually) && (
          <button type="button" style={STYLES.btnSecondary} onClick={onEnterManually}>
            {enterManuallyLabel}
          </button>
        )}
        {_isFn(onRetry) && (
          <button type="button" style={STYLES.btnSecondary} onClick={onRetry}>
            {retryLabel}
          </button>
        )}
      </div>
    </section>
  );
}
