/**
 * ScanEntryCard.jsx — RC1 calm scan landing.
 *
 *   <ScanEntryCard onTakePhoto={...} onUsePhoto={...} />
 *
 * What this is
 * ────────────
 *   Default surface rendered when the /scan route mounts. Replaces
 *   the previous behavior of auto-starting the live camera on
 *   mount — which on mobile Safari/PWA fired `getUserMedia` before
 *   any user gesture and could land on the "Camera ran into a
 *   problem" error card before the user did anything.
 *
 *   This component renders a calm two-action panel:
 *     • Take photo       → caller transitions phase to capture
 *     • Use saved photo  → caller opens file picker
 *
 *   No camera initialization happens here. No `getUserMedia` call,
 *   no permission probe, no preview mount. The user gestures FIRST,
 *   then the camera/picker fires.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe. Never throws.
 *   • All text via tSafe (English defaults are RC1 spec wording).
 *   • Action handlers are caller-controlled — no ScanRuntime,
 *     CameraRuntimeManager, or API calls from this file.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const STYLES = {
  card: {
    background:    '#FFFFFF',
    border:        '1px solid rgba(31,41,51,0.10)',
    borderRadius:  16,
    padding:       '28px 22px',
    margin:        '20px auto',
    maxWidth:      460,
    boxShadow:     '0 1px 3px rgba(31,41,51,0.06)',
    fontFamily:    'system-ui, -apple-system, sans-serif',
    textAlign:     'center',
  },
  icon: {
    width:         56,
    height:        56,
    margin:        '0 auto 14px',
    background:    '#F0F9FF',
    borderRadius:  '50%',
    display:       'flex',
    alignItems:    'center',
    justifyContent: 'center',
    fontSize:      28,
  },
  title: {
    margin:        0,
    fontSize:      20,
    fontWeight:    700,
    color:         '#1F2933',
    marginBottom:  8,
  },
  body: {
    margin:        0,
    fontSize:      15,
    lineHeight:    1.5,
    color:         '#475569',
    marginBottom:  22,
  },
  actions: {
    display:       'flex',
    flexDirection: 'column',
    gap:           10,
  },
  btnPrimary: {
    appearance:    'none',
    border:        'none',
    background:    '#16A34A',
    color:         '#FFFFFF',
    fontWeight:    600,
    fontSize:      15,
    padding:       '12px 16px',
    borderRadius:  12,
    cursor:        'pointer',
    fontFamily:    'inherit',
  },
  btnSecondary: {
    appearance:    'none',
    border:        '1px solid rgba(31,41,51,0.18)',
    background:    'transparent',
    color:         '#1F2933',
    fontWeight:    600,
    fontSize:      15,
    padding:       '12px 16px',
    borderRadius:  12,
    cursor:        'pointer',
    fontFamily:    'inherit',
  },
  hint: {
    margin:        '14px 0 0',
    fontSize:      12,
    color:         '#94A3B8',
  },
};

const _isFn = (v) => typeof v === 'function';

export default function ScanEntryCard({ onTakePhoto, onUsePhoto }) {
  return (
    <section
      style={STYLES.card}
      data-testid="scan-entry-card"
      data-scan-default-mode="idle"
      role="region"
      aria-label={tSafe('scan.entry.title', 'Scan your crop')}
    >
      <div style={STYLES.icon} aria-hidden="true">🌿</div>
      <h2 style={STYLES.title}>
        {tSafe('scan.entry.title', 'Scan your crop')}
      </h2>
      <p style={STYLES.body}>
        {tSafe(
          'scan.entry.body',
          'Take or upload a clear photo of the affected leaf, crop, or plant.',
        )}
      </p>
      <div style={STYLES.actions}>
        <button
          type="button"
          style={STYLES.btnPrimary}
          onClick={_isFn(onTakePhoto) ? onTakePhoto : undefined}
          disabled={!_isFn(onTakePhoto)}
          data-testid="scan-entry-take-photo"
        >
          {tSafe('scan.entry.takePhoto', 'Take photo')}
        </button>
        <button
          type="button"
          style={STYLES.btnSecondary}
          onClick={_isFn(onUsePhoto) ? onUsePhoto : undefined}
          disabled={!_isFn(onUsePhoto)}
          data-testid="scan-entry-use-saved-photo"
        >
          {tSafe('scan.entry.useSavedPhoto', 'Use saved photo')}
        </button>
      </div>
      <p style={STYLES.hint}>
        {tSafe(
          'scan.entry.hint',
          'For best results, fill the frame with the affected leaf.',
        )}
      </p>
    </section>
  );
}
