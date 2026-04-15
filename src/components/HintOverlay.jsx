/**
 * HintOverlay — lightweight one-time hint bubble.
 *
 * Shows a small overlay with a short message + arrow.
 * Dismissed on tap anywhere. Shows only once per hintId.
 * If user is experienced (3+ hints dismissed), shows nothing.
 */
import { useState, useEffect } from 'react';
import { shouldShowHint, dismissHint, isExperiencedUser } from '../lib/hints.js';

export default function HintOverlay({ hintId, message, position = 'bottom' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay show so it appears after content renders
    if (!isExperiencedUser() && shouldShowHint(hintId)) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [hintId]);

  if (!visible) return null;

  const handleDismiss = () => {
    dismissHint(hintId);
    setVisible(false);
  };

  const isTop = position === 'top';

  return (
    <div
      onClick={handleDismiss}
      style={S.overlay}
      data-testid={`hint-${hintId}`}
      role="tooltip"
    >
      <div style={{ ...S.bubble, ...(isTop ? S.bubbleTop : S.bubbleBottom) }}>
        <span style={S.arrow}>{isTop ? '↑' : '↓'}</span>
        <span style={S.text}>{message}</span>
        <span style={S.dismiss}>✕</span>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    display: 'flex',
    justifyContent: 'center',
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  bubble: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    borderRadius: '12px',
    background: 'rgba(34,197,94,0.95)',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 600,
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    maxWidth: '18rem',
    animation: 'farroway-fadeIn 0.3s ease',
  },
  bubbleTop: {
    marginTop: '-3rem',
  },
  bubbleBottom: {
    marginTop: '0.5rem',
  },
  arrow: {
    fontSize: '0.9rem',
    opacity: 0.7,
  },
  text: {
    flex: 1,
    lineHeight: 1.3,
  },
  dismiss: {
    fontSize: '0.75rem',
    opacity: 0.6,
    flexShrink: 0,
  },
};
