/**
 * VoiceReplayButton — 🔁 chip that re-plays the last spoken
 * voice phrase.
 *
 * Pairs with `playVoice()` — every call to `playVoice` stamps
 * `last = { text, lang }`, and this button calls `replayLast()`.
 *
 * Self-hides when:
 *   • voice mute is on (no point replaying nothing), OR
 *   • caller explicitly passes `text` and the global last-spoken
 *     is empty (nothing to replay yet).
 *
 * Two call patterns:
 *
 *   1. Generic — replay whatever was last spoken anywhere:
 *        <VoiceReplayButton />
 *
 *   2. Scoped — re-speak a specific phrase (the consumer owns
 *      the text); useful on cards where the user might want to
 *      hear THIS card's phrase again rather than whatever the
 *      app last said.
 *        <VoiceReplayButton text={twiVoice.scan.issue} lang="tw" />
 */

import { useCallback } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import useVoiceMute from '../../hooks/useVoiceMute.js';
import { playVoice, replayLast } from '../../utils/voicePlayer.js';

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
    fontSize: 16,
    lineHeight: 1,
  },
};

export default function VoiceReplayButton({
  text = '',
  lang = 'tw',
  className = '',
}) {
  // Subscribe to language change.
  useTranslation();
  const { muted } = useVoiceMute();

  const onClick = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    if (muted) return;
    if (text) {
      playVoice(text, lang);
    } else {
      replayLast();
    }
  }, [muted, text, lang]);

  if (muted) return null;

  const aria = tStrict('voice.replay.aria', 'Replay');

  return (
    <button
      type="button"
      onClick={onClick}
      className={('voice-replay-btn ' + className).trim()}
      style={STYLES.btn}
      aria-label={aria}
      data-testid="voice-replay-btn"
      data-i18n-skip
    >
      <span aria-hidden="true">{'\uD83D\uDD01'}</span>
    </button>
  );
}
