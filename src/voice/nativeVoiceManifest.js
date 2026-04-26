/**
 * nativeVoiceManifest.js — top-tier mapping from (lang × i18n key)
 * to a native-speaker mp3 served from `public/voice/<lang>/`.
 *
 * Why a manifest instead of a generated path
 * ──────────────────────────────────────────
 * A static manifest gives us three things the existing
 * `voicePrompts.js` clip table doesn't:
 *
 *   • Direct keying by the SAME i18n key the UI already renders
 *     (`progress.cropStartingMessage`, `actions.markDone`, …) so
 *     `<VoiceButton labelKey="…" />` lights up native audio without
 *     a separate prompt-id mapping table.
 *   • A clear shipping contract for non-engineering owners — they
 *     drop a file at the documented path, add the entry here,
 *     done. No code changes required to play it.
 *   • A safe failure mode — when a file isn't yet recorded, the
 *     entry is simply absent and `voiceEngine.speakKey` falls
 *     through to the existing 3-tier pipeline (prerecorded clip
 *     in `voicePrompts.js` → provider TTS → browser TTS).
 *
 * Coexistence with the existing voice stack
 * ─────────────────────────────────────────
 *   Top tier (new):    `public/voice/<lang>/...mp3`   ← THIS file
 *   Tier 1:            `public/audio/tw/*.mp3`        ← voicePrompts.js
 *   Tier 2:            provider TTS                    ← voiceService.js
 *   Tier 3 (fallback): browser speechSynthesis         ← voiceEngine.js
 *
 * The manifest is intentionally sparse. Add entries as native
 * recordings are produced; never block a release on a missing one.
 */

export const nativeVoiceManifest = Object.freeze({
  tw: Object.freeze({
    'progress.cropStartingMessage': '/voice/tw/progress_crop_starting.mp3',
    'progress.nextAction':          '/voice/tw/progress_next_action.mp3',
    'actions.markDone':             '/voice/tw/actions_mark_done.mp3',
    'actions.skip':                 '/voice/tw/actions_skip.mp3',
    'nav.home':                     '/voice/tw/nav_home.mp3',
    'nav.myFarm':                   '/voice/tw/nav_my_farm.mp3',
    'nav.tasks':                    '/voice/tw/nav_tasks.mp3',
    'nav.progress':                 '/voice/tw/nav_progress.mp3',
  }),
  ha: Object.freeze({
    'progress.cropStartingMessage': '/voice/ha/progress_crop_starting.mp3',
    'progress.nextAction':          '/voice/ha/progress_next_action.mp3',
    'actions.markDone':             '/voice/ha/actions_mark_done.mp3',
    'actions.skip':                 '/voice/ha/actions_skip.mp3',
    'nav.home':                     '/voice/ha/nav_home.mp3',
    'nav.myFarm':                   '/voice/ha/nav_my_farm.mp3',
    'nav.tasks':                    '/voice/ha/nav_tasks.mp3',
    'nav.progress':                 '/voice/ha/nav_progress.mp3',
  }),
  hi: Object.freeze({}),
  fr: Object.freeze({}),
});

/**
 * Look up a native audio path for (lang, key). Returns null when
 * the manifest has no entry — caller should fall through to the
 * next tier of the pipeline.
 */
export function nativeAudioFor(lang, key) {
  if (!lang || !key) return null;
  const slot = nativeVoiceManifest[lang];
  if (!slot) return null;
  return slot[key] || null;
}

export default nativeVoiceManifest;
