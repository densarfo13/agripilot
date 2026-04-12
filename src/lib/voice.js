export function speakText(text, lang = 'en-US') {
  if (!('speechSynthesis' in window) || !text) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function languageToVoiceCode(language) {
  if (language === 'fr') return 'fr-FR';
  if (language === 'ha') return 'en-US';
  if (language === 'tw') return 'en-US';
  return 'en-US';
}
