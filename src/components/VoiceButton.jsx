/**
 * VoiceButton — tap-to-hear button for low-literacy farmer surfaces.
 *
 * Renders a 🔊 button that, on tap, speaks `text` (or the translation
 * of `labelKey`) in the active UI language. Uses the existing i18n
 * system + the new strict translator so that:
 *
 *   • we never speak an English string inside a non-English UI
 *   • when speech synthesis is unavailable, the button hides itself
 *     instead of showing a dead control
 *
 * The component subscribes to language change via useTranslation()
 * so a language switch immediately changes both the displayed
 * accessible name and the text spoken on the next press.
 *
 * Props
 * ─────
 *   text       string  — already-translated text to speak (wins if present)
 *   labelKey   string  — i18n key, used only when `text` is empty
 *   className  string  — extra classes appended to the default chip style
 *   size       'sm'|'md'|'lg' — defaults to 'md'; lg used in icon mode
 *   ariaKey    string  — i18n key for aria-label override (defaults to common.listen)
 */

import { useCallback, useMemo } from 'react';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tStrict } from '../i18n/strictT.js';
import { speak, speakKey, isSpeakSupported } from '../voice/voiceEngine.js';

const SIZE_CLASS = {
  sm: 'voice-btn voice-btn--sm',
  md: 'voice-btn voice-btn--md',
  lg: 'voice-btn voice-btn--lg',
};

export default function VoiceButton({
  text = '',
  labelKey = '',
  className = '',
  size = 'md',
  ariaKey = 'common.listen',
}) {
  const { lang } = useTranslation();

  // Resolve the spoken text. Caller may pass either an explicit
  // already-translated `text` (preferred for dynamic content like
  // farmer name or crop label) or a static `labelKey`.
  const spoken = useMemo(() => {
    if (text && String(text).trim()) return String(text).trim();
    if (labelKey) return tStrict(labelKey, '');
    return '';
  }, [text, labelKey, lang]);

  const ariaLabel = tStrict(ariaKey, 'Listen');

  const onClick = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    if (!spoken) return;
    // When a labelKey is provided, prefer the key-aware path so we
    // can hit the prerecorded-clip / provider-TTS tiers (critical
    // for Twi where browsers ship no native voice). Falls through to
    // raw text speak() inside the engine when the key has no prompt
    // mapping.
    if (labelKey) {
      speakKey(labelKey, lang || 'en', spoken);
    } else {
      speak(spoken, lang || 'en');
    }
  }, [spoken, lang, labelKey]);

  // Hide entirely when unsupported — a dead button is worse than
  // none. Callers can detect this by checking isSpeakSupported.
  if (!isSpeakSupported()) return null;

  // Don't render if there is literally nothing to say (avoids a
  // stray icon next to an empty card).
  if (!spoken) return null;

  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;
  const cls = (sizeClass + (className ? ' ' + className : '')).trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      aria-label={ariaLabel}
      data-i18n-skip
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}
