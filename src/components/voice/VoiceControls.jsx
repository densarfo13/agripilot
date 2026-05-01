/**
 * VoiceControls — Play / Stop / Replay chip group with text-only
 * fallback when the device can't speak the requested language.
 *
 * Spec contract (§4)
 *   • Play, Stop, Replay buttons
 *   • Text-only fallback message when the device has no voice
 *     for the active language
 *   • Honors `useVoiceMute` global silencing
 *
 * Composition note
 *   This component is the canonical "voice player UI" for any
 *   surface that wants Play/Replay together. The standalone
 *   `<VoiceMuteToggle>` and `<VoiceReplayButton>` chips remain
 *   for surfaces that only need one of the two actions.
 *
 * Props
 *   text       string   — the phrase to speak (already translated)
 *   lang       string   — short code or BCP-47 (default 'tw'/'ak-GH')
 *   className  string   — extra classes
 *
 * Visible labels via tStrict (no English bleed in non-en UIs).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import {
  playVoice,
  stopVoice,
  replayLast,
  canSpeakLanguage,
} from '../../utils/voicePlayer.js';
import useVoiceMute from '../../hooks/useVoiceMute.js';

const STYLES = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
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
  btnActive: {
    background: 'rgba(34,197,94,0.22)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  fallback: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.4,
    marginLeft: 6,
    maxWidth: 220,
  },
};

export default function VoiceControls({
  text = '',
  lang = 'tw',
  className = '',
}) {
  // Subscribe to language change so labels refresh.
  useTranslation();
  const { muted } = useVoiceMute();

  // Voice list populates async on Chrome — re-check after mount
  // when getVoices() finally settles.
  const [supported, setSupported] = useState(() => canSpeakLanguage(lang));
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
    const synth = window.speechSynthesis;
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      try { setSupported(canSpeakLanguage(lang)); }
      catch { /* ignore */ }
    };
    refresh();
    // Chrome fires 'voiceschanged' once voices populate; some
    // browsers never fire it. Belt-and-braces with a single
    // delayed re-check.
    try { synth.addEventListener('voiceschanged', refresh); } catch { /* ignore */ }
    const timer = setTimeout(refresh, 600);
    return () => {
      cancelled = true;
      try { synth.removeEventListener('voiceschanged', refresh); } catch { /* ignore */ }
      clearTimeout(timer);
    };
  }, [lang]);

  const onPlay = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    if (muted || !text) return;
    playVoice(text, lang);
  }, [muted, text, lang]);

  const onStop = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    stopVoice();
  }, []);

  const onReplay = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    if (muted) return;
    if (text) playVoice(text, lang); else replayLast();
  }, [muted, text, lang]);

  // When muted: surface only the unmute affordance via the
  // sibling `<VoiceMuteToggle>`. We render nothing here so the
  // user isn't tempted to tap dead buttons.
  if (muted) return null;

  // No voice for this language → show text-only message instead
  // of a row of buttons that can't be heard. The caller is
  // responsible for rendering the actual `text` content next to
  // this component, so the user can still READ what would have
  // been spoken.
  if (!supported) {
    return (
      <span
        className={('voice-controls voice-controls--fallback ' + className).trim()}
        style={STYLES.fallback}
        data-testid="voice-controls-fallback"
        data-supported="false"
      >
        {tStrict(
          'voice.controls.unavailable',
          'Audio may not be available in Twi on this device. You can still read the guidance.'
        )}
      </span>
    );
  }

  return (
    <span
      className={('voice-controls ' + className).trim()}
      style={STYLES.wrap}
      data-testid="voice-controls"
      data-supported="true"
    >
      <button
        type="button"
        onClick={onPlay}
        style={{ ...STYLES.btn, ...STYLES.btnActive }}
        aria-label={tStrict('voice.controls.play', 'Play')}
        data-testid="voice-controls-play"
        data-i18n-skip
      >
        <span aria-hidden="true">{'\u25B6'}</span>
      </button>
      <button
        type="button"
        onClick={onStop}
        style={STYLES.btn}
        aria-label={tStrict('voice.controls.stop', 'Stop')}
        data-testid="voice-controls-stop"
        data-i18n-skip
      >
        <span aria-hidden="true">{'\u25A0'}</span>
      </button>
      <button
        type="button"
        onClick={onReplay}
        style={STYLES.btn}
        aria-label={tStrict('voice.replay.aria', 'Replay')}
        data-testid="voice-controls-replay"
        data-i18n-skip
      >
        <span aria-hidden="true">{'\uD83D\uDD01'}</span>
      </button>
    </span>
  );
}
