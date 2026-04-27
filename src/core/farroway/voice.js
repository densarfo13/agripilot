/**
 * voice.js — Farroway core safe speech wrapper (spec section 5).
 *
 * `speak(text)` is fire-and-forget. It silently no-ops when:
 *   * speechSynthesis is unavailable (server / older browsers)
 *   * text is empty
 *   * the synthesizer throws mid-call
 *
 * No external dependencies, no permission prompts.
 */

export function speak(text) {
  if (!text) return;
  try {
    if (typeof window === 'undefined') return;
    if (!window.speechSynthesis) return;
    if (typeof SpeechSynthesisUtterance !== 'function') return;
    const u = new SpeechSynthesisUtterance(String(text));
    window.speechSynthesis.speak(u);
  } catch { /* never throw from a notification path */ }
}
