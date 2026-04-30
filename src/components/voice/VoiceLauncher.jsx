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

  if (!isFeatureEnabled('FEATURE_VOICE_ASSISTANT')) return null;

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
    border: '1px solid rgba(34,197,94,0.32)',
    background: 'rgba(34,197,94,0.10)',
    color: '#86EFAC',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 36,
  },
  icon: { fontSize: '0.95rem', lineHeight: 1 },
  text: { lineHeight: 1 },
};

const FLOATING = {
  btn: {
    position: 'fixed',
    right: '1rem',
    bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',  // above bottom-tab nav
    width: 56,
    height: 56,
    borderRadius: 999,
    border: 'none',
    background: '#22C55E',
    color: '#062714',
    fontSize: '1.4rem',
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(0,0,0,0.35)',
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
