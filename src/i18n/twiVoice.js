/**
 * twiVoice.js — short-phrase Twi voice dictionary.
 *
 * Why a separate dictionary
 * ─────────────────────────
 * The main `src/i18n/translations.js` has every UI string in
 * every launch language; that's the right canonical home for
 * visible TEXT. Spoken voice phrases want to be SHORT and
 * imperative — different shape, different audience. Keeping
 * them here means a content writer can polish the spoken
 * Twi in isolation without scrolling through the visual i18n
 * dictionary.
 *
 * How this composes with the rest of the voice stack
 * ──────────────────────────────────────────────────
 *   • `src/services/voicePrompts.js` — canonical prompt
 *     library used by `voiceService` for prerecorded native-
 *     speaker mp3 playback (3-tier fallback). When a phrase
 *     here matches a prompt id, the wrapper routes through
 *     voicePrompts to hit the prerecorded path.
 *   • `src/utils/voicePlayer.js` — `playVoice(text, lang)`
 *     thin wrapper that ultimately calls `voiceEngine.speak`.
 *
 * This file is **content only** — no React, no I/O.
 *
 * Usage:
 *   import { twiVoice, getTwiPhrase } from '../i18n/twiVoice.js';
 *   playVoice(getTwiPhrase('greeting'), 'tw');
 *   playVoice(twiVoice.tasks.checkPlant, 'tw');
 */

export const twiVoice = Object.freeze({
  greeting: 'Yɛnkɔ hwɛ nea wobɛyɛ nnɛ.',

  // Daily plan voice — shorter, imperative phrasing for the
  // farmer who taps Play on a daily card. Each line under ~6
  // words so playback finishes before the user moves on.
  daily: Object.freeze({
    planReady:  'Wo nnɛ plan no ayɛ krado.',
    checkFirst: 'Di kan hwɛ wo plant no.',
    keepSimple: 'Yɛ no nkakrankakra. Eno ara yɛ.',
  }),

  tasks: Object.freeze({
    checkPlant:     'Hwɛ wo plant no nnɛ.',
    checkCrop:      'Hwɛ wo crop no nnɛ.',
    water:          'Sɛ asase no ayɛ kusuu a, fa nsuo kakra gu so.',
    inspectLeaves:  'Hwɛ sɛ ahaban no ho tew anaa asɛe.',
    scan:           'Sɛ wuhu biribi a ɛnyɛ yie a, fa foto.',
  }),

  scan: Object.freeze({
    issue:   'Ebia ɔhaw kakra wɔ plant no ho.',
    cause:   'Ebia nsuo dodo, asase kusuu, anaa mmoawa na ɛde bae.',
    action:  'Hwɛ ahaban no, na san hwɛ no bio ɔkyena.',
    retake:  'Sɛ foto no nna adi yie a, san fa foforo.',
    help:    'Sɛ ɔhaw no kɔ so a, bisa obi a ɔnim ho.',
  }),

  // Weather voice cues — fired only when the daily plan
  // surfaces a real weather alert. Three short lines.
  weather: Object.freeze({
    rain:        'Osuo betumi atɔ nnɛ. Ngu nsuo pii.',
    heat:        'Ɛnnɛ yɛ hyew. Hwɛ sɛ asase no ayɛ kusuu anaa.',
    unavailable: 'Yɛntumi nnya wim tebea seesei.',
  }),

  // Ask Farroway suggested questions — used when the user opens
  // the voice navigator. Helps low-literacy farmers know what
  // they can ask out loud.
  ask: Object.freeze({
    prompt:   'Dɛn na wopɛ sɛ Farroway boa wo ho?',
    today:    'Dɛn na meyɛ nnɛ?',
    water:    'Mɛfa nsuo bere bɛn?',
    plantOk:  'Me plant no ho yɛ anaa?',
  }),
});

/**
 * getTwiPhrase('greeting' | 'tasks.checkPlant' | 'scan.issue' | …)
 *   Dotted-path resolver so call sites can keep their key
 *   strings consistent with the prompt-id namespace used by
 *   the rest of the voice stack. Returns '' on any miss so
 *   the player no-ops cleanly.
 */
export function getTwiPhrase(path) {
  if (!path || typeof path !== 'string') return '';
  const parts = path.split('.');
  let cur = twiVoice;
  for (const seg of parts) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = cur[seg];
  }
  return typeof cur === 'string' ? cur : '';
}

export default twiVoice;
