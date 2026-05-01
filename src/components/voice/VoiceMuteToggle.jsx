/**
 * VoiceMuteToggle — small 🔊 / 📴 chip that flips the global
 * voice-guidance mute bit.
 *
 * Coexists with the existing `VoiceButton` (per-text playback
 * trigger) — that one starts speech, this one silences it.
 *
 * Visible label routes through tStrict so non-English UIs see
 * the right localized aria-label.
 *
 * Self-hides nothing — the chip is the way users opt OUT of the
 * auto-play hooks (Home greeting / Task tap / Scan result), so
 * it must stay reachable even when the page is otherwise quiet.
 */

import { useCallback } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import useVoiceMute from '../../hooks/useVoiceMute.js';

const STYLES = {
  btn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    width: 36,
    height: 36,
    borderRadius: 999,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    lineHeight: 1,
    transition: 'background 120ms ease',
  },
  btnActive: {
    background: 'rgba(34,197,94,0.22)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
};

export default function VoiceMuteToggle({ className = '' }) {
  // Subscribe to language change so the aria-label refreshes.
  useTranslation();
  const { muted, toggle } = useVoiceMute();

  const onClick = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    toggle();
  }, [toggle]);

  const aria = muted
    ? tStrict('voice.mute.unmuteAria', 'Unmute voice')
    : tStrict('voice.mute.muteAria',   'Mute voice');

  return (
    <button
      type="button"
      onClick={onClick}
      className={('voice-mute-toggle ' + className).trim()}
      style={{ ...STYLES.btn, ...(muted ? null : STYLES.btnActive) }}
      aria-label={aria}
      aria-pressed={muted}
      data-testid="voice-mute-toggle"
      data-muted={muted ? 'true' : 'false'}
      data-i18n-skip
    >
      <span aria-hidden="true">{muted ? '\uD83D\uDCF4' : '\uD83D\uDD0A'}</span>
    </button>
  );
}
