/**
 * Voice utilities — thin wrappers around voiceService.
 *
 * Previously called browser speechSynthesis directly.
 * Now routes through voiceService for 3-tier fallback:
 *   1. Prerecorded clip
 *   2. Provider TTS (neural)
 *   3. Browser TTS (last resort)
 */

import voiceService from '../services/voiceService.js';

export function speakText(text, lang = 'en-US') {
  if (!text) return;
  // Convert BCP-47 to short code for voiceService
  const shortLang = lang.slice(0, 2).toLowerCase();
  voiceService.speakText(text, shortLang);
}

export function stopSpeaking() {
  voiceService.stop();
}

export function languageToVoiceCode(language) {
  if (language === 'fr') return 'fr';
  if (language === 'sw') return 'sw';
  if (language === 'ha') return 'ha';
  if (language === 'tw') return 'tw';
  return 'en';
}
