/**
 * MicInput — speak-to-fill helper for short text inputs.
 *
 * Renders a 🎤 button that, on press, starts a one-shot speech
 * recognition session and forwards the best transcript to
 * `onText(text)`. Designed for short single-field inputs (farm name,
 * search query, free-text feedback) — not paragraph dictation.
 *
 * Behaviour
 * ─────────
 *   • Uses the active UI language for recognition. ha/tw fall back
 *     to en-NG / en-US in the engine; the user will see a small
 *     hint when recognition isn't available.
 *   • When the browser doesn't ship SpeechRecognition (Firefox,
 *     iOS Safari today), the button still renders but is disabled
 *     and shows a non-blocking hint string (caller can also
 *     conditionally hide the whole control via isListenSupported).
 *   • Visual state: idle (🎤) / listening (🎙 with pulse class).
 *   • Never throws.
 *
 * Props
 * ─────
 *   onText           (text:string) => void — required handler
 *   placeholderKey   string — i18n key for the helper hint underneath
 *   className        string — extra classes appended to the button
 *   ariaKey          string — i18n key for aria-label (default common.startVoiceInput)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tStrict } from '../i18n/strictT.js';
import { startListening, isListenSupported } from '../voice/voiceEngine.js';

export default function MicInput({
  onText,
  placeholderKey = '',
  className = '',
  ariaKey = 'common.startVoiceInput',
}) {
  const { lang } = useTranslation();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const supported = isListenSupported();

  // Stop any in-flight session if the component unmounts.
  useEffect(() => () => {
    try { abortRef.current?.(); } catch { /* ignore */ }
  }, []);

  const onClick = useCallback((e) => {
    try { e.stopPropagation?.(); } catch { /* ignore */ }
    if (!supported) return;
    if (listening) {
      try { abortRef.current?.(); } catch { /* ignore */ }
      setListening(false);
      return;
    }
    setError('');
    setListening(true);
    abortRef.current = startListening(
      (text) => {
        setListening(false);
        if (typeof onText === 'function' && text) {
          try { onText(text); } catch { /* never propagate */ }
        }
      },
      lang || 'en',
      {
        onError: (code) => {
          setListening(false);
          // Common codes: 'not-allowed', 'no-speech', 'network',
          // 'aborted', 'unsupported'. Keep the message short and
          // localised — caller passes placeholderKey for context.
          setError(code || 'error');
        },
      },
    );
  }, [supported, listening, lang, onText]);

  const ariaLabel = tStrict(ariaKey, 'Voice input');
  const placeholderText = placeholderKey ? tStrict(placeholderKey, '') : '';
  const unsupportedHint = tStrict('common.voiceInputUnsupported', '');
  const errorHint = tStrict('common.voiceInputFailed', '');

  const baseCls = 'mic-btn' + (listening ? ' mic-btn--active' : '');
  const cls = (baseCls + (className ? ' ' + className : '')).trim();

  return (
    <span className="mic-input-wrap">
      <button
        type="button"
        onClick={onClick}
        className={cls}
        aria-label={ariaLabel}
        aria-pressed={listening}
        disabled={!supported}
        data-i18n-skip
      >
        <span aria-hidden="true">{listening ? '🎙' : '🎤'}</span>
      </button>
      {/* Non-blocking hints; rendered only when meaningful text exists. */}
      {!supported && unsupportedHint ? (
        <small className="mic-hint mic-hint--unsupported">{unsupportedHint}</small>
      ) : null}
      {supported && error && errorHint ? (
        <small className="mic-hint mic-hint--error">{errorHint}</small>
      ) : null}
      {supported && !error && placeholderText ? (
        <small className="mic-hint">{placeholderText}</small>
      ) : null}
    </span>
  );
}
