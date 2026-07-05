/**
 * voiceInput.js — Jarvis MVP speech-to-text adapter (Web Speech API only).
 *
 * On-device/browser STT where the platform provides it; NO cloud speech service,
 * no audio ever leaves the device via Farroway. Where unsupported (or offline),
 * `available()` is false and the panel uses the text field — the universal
 * fallback. Never throws.
 */

function _ctor() {
  try {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  } catch { return null; }
}

export function voiceAvailable() {
  try {
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    return !!_ctor() && online;
  } catch { return false; }
}

/**
 * startListening({ lang, onResult, onError, onEnd }) → stop() | null
 */
export function startListening({ lang, onResult, onError, onEnd }) {
  const Ctor = _ctor();
  if (!Ctor) { try { onError && onError('unsupported'); } catch { /* ignore */ } return null; }
  let rec;
  try {
    rec = new Ctor();
    rec.lang = lang || 'en';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      try {
        const t = e && e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
        onResult && onResult(String(t || ''));
      } catch { onError && onError('result_parse'); }
    };
    rec.onerror = (e) => { try { onError && onError((e && e.error) || 'error'); } catch { /* ignore */ } };
    rec.onend = () => { try { onEnd && onEnd(); } catch { /* ignore */ } };
    rec.start();
  } catch { try { onError && onError('start_failed'); } catch { /* ignore */ } return null; }
  return () => { try { rec.stop(); } catch { /* ignore */ } };
}

export default { voiceAvailable, startListening };
