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
  welcome: 'onboarding', farmName: 'onboarding', country: 'onboarding',
  crop: 'onboarding', farmSize: 'onboarding', gender: 'onboarding',
  age: 'onboarding', location: 'onboarding', photo: 'onboarding',
  processing: 'onboarding',
  // Farmer home
  home_welcome: 'farmer_home', home_status: 'farmer_home',
  home_action: 'farmer_home', home_next_step: 'farmer_home',
  home_help: 'farmer_home',
  // Add update flow
  update_start: 'update_flow', update_choose_type: 'update_flow',
  update_stage: 'update_flow', update_condition: 'update_flow',
  update_photo: 'update_flow', update_note: 'update_flow',
  update_submitting: 'update_flow', update_success: 'update_flow',
  update_offline: 'update_flow', update_failed: 'update_flow',
  // Officer validation
  officer_queue: 'officer_validation', officer_open_item: 'officer_validation',
  officer_action: 'officer_validation', officer_next_item: 'officer_validation',
  officer_empty: 'officer_validation',
  // Admin dashboard
  admin_overview: 'admin_dashboard', admin_active_farmers: 'admin_dashboard',
  admin_needs_attention: 'admin_dashboard', admin_actions: 'admin_dashboard',
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
