/**
 * VoiceLauncher — the "Ask Farroway 🎤" entry point that
 * surfaces the VoiceAssistant bottom sheet.
 *
 * Mountable from Home, My Farm, Tasks, Weather card, Help.
 * One props-driven component so the visual style adapts:
 *
 *   <VoiceLauncher />                          // default chip
 *   <VoiceLauncher variant="floating" />        // FAB on Home
 *   <VoiceLauncher variant="inline" />          // header link
 *
 * Hides itself when FEATURE_VOICE_ASSISTANT is off (spec §14).
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import VoiceAssistant from './VoiceAssistant.jsx';

export default function VoiceLauncher({
  variant = 'chip',   // 'chip' | 'floating' | 'inline'
  style,
  label,
}) {
  const [open, setOpen] = React.useState(false);

  // Honor either flag — FEATURE_VOICE_ASSISTANT (legacy) or
  // FEATURE_VOICE_GUIDE (Voice Guide v1 spec). Both surface the
  // same assistant. Hidden only when BOTH are off.
  if (!isFeatureEnabled('FEATURE_VOICE_ASSISTANT')
      && !isFeatureEnabled('FEATURE_VOICE_GUIDE')) {
    return null;
  }

  const text = label || tSafe('voice.askFarroway', 'Ask Farroway');
  const styles = pickStyles(variant);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...styles.btn, ...(style || {}) }}
        aria-label={text}
        data-testid="voice-launcher"
      >
        <span style={styles.icon} aria-hidden="true">{'\uD83C\uDFA4'}</span>
        {variant !== 'floating' && (
          <span style={styles.text}>{text}</span>
        )}
      </button>
      <VoiceAssistant open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function pickStyles(variant) {
  if (variant === 'floating') return FLOATING;
  if (variant === 'inline')   return INLINE;
  return CHIP;
}

const CHIP = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.875rem',
    borderRadius: 999,
    border: '1px solid rgba(200,148,77,0.32)',
    background: 'rgba(200,148,77,0.10)',
    color: '#86EFAC',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 36,
  },
  icon: { fontSize: '0.95rem', lineHeight: 1 },
  text: { lineHeight: 1 },
};

// Optimize First Action Completion (CRITICAL) §5 — floating
// launcher made smaller + lower so it never visually competes
// with the FirstActionGate's Done CTA. 56 → 48 px is still
// well above Apple's 44px minimum tap target; bottom offset
// dropped from 74 → 64 px so the chip sits closer to the
// nav bar where it reads as a quiet utility, not a primary
// affordance.
const FLOATING = {
  btn: {
    position: 'fixed',
    right: '1rem',
    bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
    width: 48,
    height: 48,
    borderRadius: 999,
    border: 'none',
    background: '#C8944D',
    color: '#FFFFFF',
    fontSize: '1.2rem',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(0,0,0,0.30)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: '1.4rem', lineHeight: 1 },
  text: {},
};

const INLINE = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    padding: '0.375rem 0.625rem',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: '#86EFAC',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 32,
  },
  icon: { fontSize: '0.95rem', lineHeight: 1 },
  text: { lineHeight: 1 },
};
