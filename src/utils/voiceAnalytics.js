/**
 * Voice Analytics — lightweight tracking for voice guidance usage.
 *
 * Dual-write strategy:
 *   1. localStorage ring buffer (via pilotTracker) — works offline, device-local
 *   2. Server-side analytics_events table (via /v1/analytics/track) — admin-visible
 *
 * Events:
 *   VOICE_PROMPT_SHOWN     — VoiceBar rendered for a prompt key
 *   VOICE_PROMPT_PLAYED    — TTS auto-played for first time on a step
 *   VOICE_PROMPT_REPLAYED  — user tapped Listen to replay
 *   VOICE_PROMPT_MUTED     — user tapped mute
 *   VOICE_STEP_COMPLETED   — user completed a step after hearing prompt
 *   VOICE_STEP_ABANDONED   — user left a step without completing (navigated away)
 *
 * Fields per event:
 *   promptKey, language, screenName (derived), timestamp (auto)
 *   userRole and orgId are added server-side from auth context.
 *
 * No raw audio is stored. No heavy infrastructure.
 */

import { trackPilotEvent } from './pilotTracker.js';
import api from '../api/client.js';

// ─── Prompt key → screen name mapping ─────────────────────────

const SCREEN_MAP = {
  // Onboarding
  'onboarding.welcome': 'onboarding', 'onboarding.language': 'onboarding',
  'onboarding.farmName': 'onboarding', 'onboarding.country': 'onboarding',
  'onboarding.crop': 'onboarding', 'onboarding.otherCrop': 'onboarding',
  'onboarding.landSize': 'onboarding', 'onboarding.landUnit': 'onboarding',
  'onboarding.gender': 'onboarding', 'onboarding.ageGroup': 'onboarding',
  'onboarding.region': 'onboarding', 'onboarding.confirmLocation': 'onboarding',
  'onboarding.photoOptional': 'onboarding', 'onboarding.processing': 'onboarding',
  'onboarding.success': 'onboarding',
  // Farmer home
  'home.welcome': 'farmer_home', 'home.status.onTrack': 'farmer_home',
  'home.status.needsUpdate': 'farmer_home', 'home.primaryAction.addUpdate': 'farmer_home',
  'home.nextStep.photo': 'farmer_home', 'home.nextStep.stage': 'farmer_home',
  'home.help': 'farmer_home',
  // Add update flow
  'update.start': 'update_flow', 'update.chooseType': 'update_flow',
  'update.option.progress': 'update_flow', 'update.option.photo': 'update_flow',
  'update.option.issue': 'update_flow', 'update.takePhoto': 'update_flow',
  'update.uploadPhoto': 'update_flow', 'update.chooseStage': 'update_flow',
  'update.condition': 'update_flow', 'update.problemNote': 'update_flow',
  'update.submit': 'update_flow', 'update.success': 'update_flow',
  'update.pendingValidation': 'update_flow', 'update.savedOffline': 'update_flow',
  'update.failed': 'update_flow',
  // Officer validation
  'officer.queue': 'officer_validation', 'officer.openItem': 'officer_validation',
  'officer.imageFocus': 'officer_validation', 'officer.approve': 'officer_validation',
  'officer.reject': 'officer_validation', 'officer.flag': 'officer_validation',
  'officer.next': 'officer_validation', 'officer.empty': 'officer_validation',
  // Admin dashboard
  'admin.overview': 'admin_dashboard', 'admin.needsAttention': 'admin_dashboard',
  'admin.openIssues': 'admin_dashboard', 'admin.invite': 'admin_dashboard',
  'admin.assign': 'admin_dashboard', 'admin.report': 'admin_dashboard',
  // Pest risk check
  'pest.start': 'pest_check', 'pest.chooseCrop': 'pest_check',
  'pest.takePhotos': 'pest_check', 'pest.photoRetake': 'pest_check',
  'pest.answerQuestions': 'pest_check', 'pest.submit': 'pest_check',
  'pest.submitting': 'pest_check',
  // Pest risk result
  'pest.result': 'pest_result', 'pest.result.low': 'pest_result',
  'pest.result.high': 'pest_result', 'pest.result.uncertain': 'pest_result',
  // Land boundary
  'boundary.start': 'boundary_capture', 'boundary.chooseMethod': 'boundary_capture',
  'boundary.walking': 'boundary_capture', 'boundary.addPoint': 'boundary_capture',
  'boundary.saved': 'boundary_capture', 'boundary.warning': 'boundary_capture',
  // Progress / harvest
  'progress.start': 'progress_update', 'progress.chooseStage': 'progress_update',
  'progress.condition': 'progress_update', 'progress.harvest': 'progress_update',
  'progress.saved': 'progress_update',
  // Treatment feedback
  'treatment.start': 'treatment_feedback', 'treatment.chooseType': 'treatment_feedback',
  'treatment.outcome': 'treatment_feedback', 'treatment.saved': 'treatment_feedback',
  // Seed scan
  'seedScan.start': 'seed_scan', 'seedScan.takePhoto': 'seed_scan',
  'seedScan.result': 'seed_scan',
  // Error / offline
  'error.general': 'error_state', 'error.offline': 'error_state',
  'error.retry': 'error_state',
  // Profile setup
  'setup.welcome': 'profile_setup', 'setup.saved': 'profile_setup',
};

function getScreenName(promptKey) {
  return SCREEN_MAP[promptKey] || 'unknown';
}

// ─── Debounce SHOWN events (fires frequently on re-renders) ──

let lastShownKey = null;
let lastShownTs = 0;
const SHOWN_DEBOUNCE_MS = 2000;

// ─── Track a voice analytics event ───────────────────────────

/**
 * @param {string} eventType — one of the VOICE_* event constants
 * @param {object} fields — { promptKey, language, ...extra }
 */
export function trackVoiceEvent(eventType, fields = {}) {
  const { promptKey, language, ...extra } = fields;

  // Debounce SHOWN events — same key within 2s is a re-render, not a new view
  if (eventType === 'VOICE_PROMPT_SHOWN') {
    const now = Date.now();
    if (promptKey === lastShownKey && now - lastShownTs < SHOWN_DEBOUNCE_MS) return;
    lastShownKey = promptKey;
    lastShownTs = now;
  }

  const screenName = getScreenName(promptKey);
  const meta = { promptKey, language, screenName, ...extra };

  // 1. Local tracking (always works, including offline)
  trackPilotEvent(eventType, meta);

  // 2. Server tracking (fire-and-forget, silent failure)
  api.post('/v1/analytics/track', {
    event: eventType,
    metadata: meta,
  }).catch(() => {}); // never block UI
}

// ─── Convenience: track step completion after voice prompt ────

/**
 * Call when a user completes a step that had a voice prompt.
 * @param {string} promptKey — the voice key that was playing
 * @param {string} language — current voice language
 */
export function trackVoiceStepCompleted(promptKey, language) {
  trackVoiceEvent('VOICE_STEP_COMPLETED', { promptKey, language });
}

/**
 * Call when a user leaves a step without completing.
 * @param {string} promptKey — the voice key that was playing
 * @param {string} language — current voice language
 */
export function trackVoiceStepAbandoned(promptKey, language) {
  trackVoiceEvent('VOICE_STEP_ABANDONED', { promptKey, language });
}

// ─── Local summary (for on-device debugging / export) ─────────

/**
 * Get voice analytics summary from localStorage pilot metrics.
 * @returns {{ byEvent, byPrompt, byLanguage, byScreen }}
 */
export function getVoiceAnalyticsSummary() {
  try {
    const all = JSON.parse(localStorage.getItem('farroway:pilot_metrics') || '[]');
    const voiceEvents = all.filter(e => e.event?.startsWith('VOICE_'));

    const byEvent = {};
    const byPrompt = {};
    const byLanguage = {};
    const byScreen = {};

    for (const e of voiceEvents) {
      // By event type
      byEvent[e.event] = (byEvent[e.event] || 0) + 1;

      // By prompt key
      if (e.promptKey) {
        byPrompt[e.promptKey] = byPrompt[e.promptKey] || { shown: 0, played: 0, replayed: 0 };
        if (e.event === 'VOICE_PROMPT_SHOWN') byPrompt[e.promptKey].shown++;
        if (e.event === 'VOICE_PROMPT_PLAYED') byPrompt[e.promptKey].played++;
        if (e.event === 'VOICE_PROMPT_REPLAYED') byPrompt[e.promptKey].replayed++;
      }

      // By language
      if (e.language) {
        byLanguage[e.language] = (byLanguage[e.language] || 0) + 1;
      }

      // By screen
      if (e.screenName) {
        byScreen[e.screenName] = (byScreen[e.screenName] || 0) + 1;
      }
    }

    return { byEvent, byPrompt, byLanguage, byScreen, total: voiceEvents.length };
  } catch {
    return { byEvent: {}, byPrompt: {}, byLanguage: {}, byScreen: {}, total: 0 };
  }
}
