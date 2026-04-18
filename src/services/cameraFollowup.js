/**
 * cameraFollowup — next-day recheck nudge (spec §7).
 *
 * Rules:
 *   - Fires once per camera-sourced task, 20–36 hours after that task
 *     was created, only if the original was not dismissed/completed.
 *   - Uses dedicated storage so it never duplicates follow-ups.
 *   - Generates a short, action-first task via the same shape the
 *     main camera engine produces, so the UI code path is identical.
 *
 * Kept small on purpose: detect-yesterday's-scan and offer a recheck.
 * No recurring chains.
 */

import { listTemporaryTasks } from './temporaryTasks.js';
import { addTemporaryTask } from './temporaryTasks.js';

const MIN_GAP_HOURS = 20;
const MAX_GAP_HOURS = 36;
const STORAGE_KEY = 'farroway:camera_followups_fired';

function readFired() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function writeFired(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-30))); }
  catch { /* quota */ }
}

/**
 * Return the camera-sourced task that is most due for a follow-up, or
 * null if none qualifies. Pure apart from reading storage.
 */
export function findFollowupCandidate(now = Date.now()) {
  const fired = new Set(readFired());
  const candidates = listTemporaryTasks().filter(t => {
    if (t.source !== 'camera' && t.source !== 'camera_diagnosis') return false;
    if (!t.followupTaskType) return false;
    if (t.completedAt) return false;
    if (fired.has(t.id)) return false;
    const ageH = (now - t.createdAt) / (60 * 60 * 1000);
    return ageH >= MIN_GAP_HOURS && ageH <= MAX_GAP_HOURS;
  });
  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.createdAt - b.createdAt)[0];
}

/**
 * If a camera-sourced task from the prior day is still active, drop
 * one recheck task into the temporary-task store and mark the
 * original as "followed up" so it never fires twice. Returns the new
 * recheck task or null.
 */
export function maybeScheduleFollowup() {
  const candidate = findFollowupCandidate();
  if (!candidate) return null;

  const recheck = addTemporaryTask({
    source: 'camera_followup',
    issueType: candidate.issueType,
    followupTaskType: null, // don't chain follow-ups
    titleKey: 'camera.followup.title',
    whyKey: 'camera.followup.why',
    lookForKey: 'camera.followup.lookFor',
    stepsKey: 'camera.followup.steps',
    tipKey: 'camera.followup.tip',
    urgency: 'today',
    priority: 'high',
    icon: '\uD83D\uDD0D',
    iconBg: 'rgba(59,130,246,0.12)',
    expiresInHours: 24,
  });

  // Mark the original so we never double-fire
  const fired = readFired();
  fired.push(candidate.id);
  writeFired(fired);

  return recheck;
}

/**
 * Dev-time reset so tests can exercise the path multiple times.
 */
export function clearFollowupsFired() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
