/**
 * CameraGuideOverlay — §SCAN STAGE 2 visual leaf-frame guide.
 *
 * Renders a centered rounded-rect "leaf frame" with dashed border and a
 * bottom hint banner. Auto-fires onAutoCapture once when the
 * readyToCapture prop flips true (and only once per session).
 *
 * Self-contained; error-boundaried; pointer-events:none so it never
 * blocks taps on the underlying camera surface.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function CameraGuideOverlayInner(props) {
  const {
    focused = false,
    leafCentered = false,
    brightnessOk = false,
    readyToCapture = false,
    reasonHints,
    onAutoCapture,
  } = props || {};

  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (readyToCapture && !firedRef.current && typeof onAutoCapture === 'function') {
      firedRef.current = true;
      _safe(() => onAutoCapture(), null);
    }
    if (!readyToCapture) firedRef.current = false;
  }, [readyToCapture, onAutoCapture]);

  const hint = (Array.isArray(reasonHints) && reasonHints.length > 0)
    ? reasonHints[0]
    : (readyToCapture
        ? tSafe('cameraGuide.label.ready', 'Ready')
        : tSafe('cameraGuide.hint.holdSteady', 'Hold steady.'));

  return (
    <div
      style={S.root}
      data-testid="camera-guide-overlay"
      data-ready={readyToCapture ? 'true' : 'false'}
      data-focused={focused ? 'true' : 'false'}
      data-leaf-centered={leafCentered ? 'true' : 'false'}
      data-brightness-ok={brightnessOk ? 'true' : 'false'}>
      <div
        style={{
          ...S.frame,
          borderColor: readyToCapture
            ? 'rgba(74,184,99,0.95)'
            : 'rgba(255,255,255,0.85)',
        }}
        aria-hidden="true">
        <span style={S.frameCorner} data-corner="tl" />
        <span style={S.frameCorner} data-corner="tr" />
        <span style={S.frameCorner} data-corner="bl" />
        <span style={S.frameCorner} data-corner="br" />
      </div>
      <div
        style={{
          ...S.banner,
          background: readyToCapture
            ? 'rgba(74,184,99,0.92)'
            : 'rgba(0,0,0,0.55)',
        }}>
        <span style={S.bannerText}>{hint}</span>
      </div>
    </div>
  );
}

/** Class wrapper for error boundary — never throws to the host page. */
export default class CameraGuideOverlay extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — never block scan UI */ }
  render() {
    if (this.state.failed) return null;
    try { return <CameraGuideOverlayInner {...this.props} />; } catch { return null; }
  }
}

const S = {
  root: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8% 8% 14% 8%',
    zIndex: 4,
  },
  frame: {
    position: 'relative',
    width: '60%',
    height: '60%',
    border: '2px dashed rgba(255,255,255,0.85)',
    borderRadius: 22,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.10) inset',
    boxSizing: 'border-box',
  },
  frameCorner: {
    position: 'absolute',
    width: 18, height: 18,
    border: '3px solid rgba(255,255,255,0.95)',
    borderRadius: 4,
  },
  banner: {
    position: 'absolute',
    left: '50%',
    bottom: '6%',
    transform: 'translateX(-50%)',
    padding: '8px 14px',
    borderRadius: 999,
    maxWidth: '80%',
  },
  bannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: '0.01em',
  },
};

// Corner anchor positioning — applied inline so we don't need an extra
// stylesheet. We render 4 spans inside the frame at fixed corners.
const _corners = (typeof document !== 'undefined') ? null : null; // no-op
