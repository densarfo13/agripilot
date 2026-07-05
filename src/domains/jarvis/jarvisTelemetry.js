/**
 * jarvisTelemetry.js — Jarvis MVP telemetry (canonical names, spec 2026-07-05).
 *
 * Thin wrapper over the existing analytics sink (safeTrackEvent) — same consent,
 * same pipeline, same client-diagnostics mirror as every other event. Transcript
 * TEXT is never sent — only intent names and outcome flags.
 */
import { safeTrackEvent } from '../../lib/analytics.js';

export const JARVIS_EVENTS = Object.freeze([
  'jarvis_opened', 'voice_record_started', 'voice_record_completed',
  'voice_transcription_failed', 'command_classified', 'command_routed',
  'command_completed', 'command_failed', 'spoken_response_played', 'jarvis_action_clicked',
]);

export function trackJarvis(event, metadata) {
  try {
    if (!JARVIS_EVENTS.includes(event)) return;
    // Privacy: strip any transcript-ish field defensively; only structured flags ship.
    const m = { ...(metadata || {}) };
    delete m.text; delete m.transcript; delete m.utterance;
    safeTrackEvent(event, m);
  } catch { /* telemetry must never break the UI */ }
}

export default trackJarvis;
