/**
 * src/core/i18n/index.js — single import surface for the
 * localization infrastructure.
 *
 * Engines should emit LocalizedPayload. UI should call
 * renderLocalizedMessage. Voice should call speakLocalizedMessage.
 * Assistive mode consumers should run payloads through
 * resolveAssistivePayload before rendering.
 */

export {
  isLocalizedPayload,
  validateLocalizedPayload,
  makeLocalizedPayload,
  isRenderedString,
} from './localizedPayload.js';

export {
  renderLocalizedMessage,
  renderLocalizedList,
  looksLikeRawKey,
} from './renderLocalizedMessage.js';

export {
  speakLocalizedMessage,
  cancelSpeak,
  getSynth,
  localeToVoiceTag,
} from './speakLocalizedMessage.js';

export {
  NORMAL, ASSISTIVE,
  isAssistiveMode,
  resolveAssistivePayload,
  simplifyText,
  assistiveLayout,
} from './assistiveMode.js';

export {
  assertNotRawKey,
  assertEngineEmitsPayload,
  assertPayloadHasKey,
  assertNoEnglishLeakInLocale,
  assertCachedPayloadIsStructured,
} from './localeDevAssertions.js';
