/**
 * scanSessionStateMachine.js — pure session state rules + the canonical response
 * contract (PR-B, spec §3/§6). No DB, no provider, never throws. The endpoints
 * (app.js) own I/O; this owns the legal-transition rules + the shape the client
 * renders (the client never derives the next view — spec §3).
 */

import { createHash } from 'node:crypto';

export const SESSION_STATES = Object.freeze([
  'SESSION_CREATED', 'INITIAL_PHOTO_RECEIVED', 'INITIAL_ANALYSIS_COMPLETE',
  'MORE_EVIDENCE_REQUIRED', 'ADDITIONAL_PHOTO_RECEIVED', 'EVIDENCE_AGGREGATED',
  'IDENTIFICATION_PROVISIONAL', 'IDENTIFICATION_CONFIRMED',
  'HEALTH_ASSESSMENT_RUNNING', 'HEALTH_ASSESSMENT_COMPLETE',
  'EXPERT_REVIEW_REQUIRED', 'SESSION_COMPLETE', 'SESSION_FAILED', 'SESSION_EXPIRED',
]);

export const TERMINAL_STATES = Object.freeze(new Set([
  'SESSION_COMPLETE', 'SESSION_FAILED', 'EXPERT_REVIEW_REQUIRED', 'SESSION_EXPIRED',
]));

// Legal forward transitions (spec §6). Terminal states have none.
const TRANSITIONS = Object.freeze({
  SESSION_CREATED:            ['INITIAL_PHOTO_RECEIVED', 'SESSION_FAILED', 'SESSION_EXPIRED', 'EXPERT_REVIEW_REQUIRED'],
  INITIAL_PHOTO_RECEIVED:     ['INITIAL_ANALYSIS_COMPLETE', 'SESSION_FAILED'],
  INITIAL_ANALYSIS_COMPLETE:  ['MORE_EVIDENCE_REQUIRED', 'IDENTIFICATION_PROVISIONAL', 'IDENTIFICATION_CONFIRMED', 'SESSION_FAILED'],
  MORE_EVIDENCE_REQUIRED:     ['ADDITIONAL_PHOTO_RECEIVED', 'EXPERT_REVIEW_REQUIRED', 'SESSION_COMPLETE', 'SESSION_EXPIRED'],
  ADDITIONAL_PHOTO_RECEIVED:  ['EVIDENCE_AGGREGATED', 'SESSION_FAILED'],
  EVIDENCE_AGGREGATED:        ['MORE_EVIDENCE_REQUIRED', 'IDENTIFICATION_PROVISIONAL', 'IDENTIFICATION_CONFIRMED'],
  IDENTIFICATION_PROVISIONAL: ['IDENTIFICATION_CONFIRMED', 'MORE_EVIDENCE_REQUIRED', 'SESSION_COMPLETE', 'EXPERT_REVIEW_REQUIRED', 'SESSION_EXPIRED'],
  IDENTIFICATION_CONFIRMED:   ['HEALTH_ASSESSMENT_RUNNING', 'SESSION_COMPLETE', 'MORE_EVIDENCE_REQUIRED', 'EXPERT_REVIEW_REQUIRED'],
  HEALTH_ASSESSMENT_RUNNING:  ['HEALTH_ASSESSMENT_COMPLETE', 'SESSION_FAILED'],
  HEALTH_ASSESSMENT_COMPLETE: ['SESSION_COMPLETE', 'EXPERT_REVIEW_REQUIRED'],
  SESSION_COMPLETE: [], SESSION_FAILED: [], EXPERT_REVIEW_REQUIRED: [], SESSION_EXPIRED: [],
});

export function isTerminal(state) { return TERMINAL_STATES.has(String(state || '')); }
export function canTransition(from, to) {
  const allowed = TRANSITIONS[String(from || '')];
  return Array.isArray(allowed) && allowed.includes(String(to || ''));
}
/** A session accepts a new photo only when it is not terminal. */
export function canAcceptPhoto(state) { return !isTerminal(state) && SESSION_STATES.includes(String(state || '')); }

/** Deterministic sha256 of the image payload (base64 string or Buffer). Used for
 *  dedup + concurrent-safety. Never stores/logs the bytes themselves. */
export function imageHash(image) {
  try {
    let s = '';
    if (typeof image === 'string') s = image.replace(/^data:[^;]+;base64,/, '');
    else if (image && image.toString) s = image.toString('base64');
    if (!s) return null;
    return createHash('sha256').update(s).digest('hex');
  } catch { return null; }
}

const _arr = (v) => (Array.isArray(v) ? v : []);

/** Allowed farmer actions for a state (spec §3). */
export function allowedActionsFor(session) {
  const st = String(session && session.state || '');
  const idState = String(session && session.identificationState || '');
  if (isTerminal(st)) return Object.freeze(['ASK_AGRONOMIST']);
  const actions = [];
  if (st === 'MORE_EVIDENCE_REQUIRED') actions.push('ADD_REQUESTED_PHOTO');
  if (idState === 'PROVISIONAL' || st === 'IDENTIFICATION_PROVISIONAL') actions.push('CONFIRM_PLANT');
  actions.push('FINISH_WITH_CURRENT_RESULT', 'ESCALATE');
  return Object.freeze(Array.from(new Set(actions)));
}

/**
 * The canonical session response (spec §3). Pure — derived entirely from the
 * persisted session + its images. The client renders this; it never re-derives
 * the next view or the identification state.
 */
export function buildSessionResponse(session, opts = {}) {
  const s = session && typeof session === 'object' ? session : {};
  const maxImages = Number.isInteger(opts.maxImages) ? opts.maxImages : 3;
  const nextView = s.requestedView
    ? Object.freeze({
        viewType: s.requestedView,
        reasonCode: s.requestedReasonCode || null,
        instruction: opts.instruction || null,
        instructionKey: opts.instructionKey || null,
      })
    : null;
  return Object.freeze({
    sessionId: s.id || null,
    state: s.state || 'SESSION_CREATED',
    photoProgress: Object.freeze({ received: Number(s.imageCount) || 0, maximum: maxImages }),
    identification: Object.freeze({
      state: s.identificationState || 'NOT_RUN',
      candidates: Object.freeze(_arr(s.candidates)),
      confirmedTaxonId: s.confirmedTaxonId || null,
    }),
    health: Object.freeze({ state: s.healthState || 'NOT_RUN' }),
    nextView,
    allowedActions: allowedActionsFor(s),
    expiresAt: s.expiresAt || null,
    completedAt: s.completedAt || null,
  });
}

export default {
  SESSION_STATES, TERMINAL_STATES, isTerminal, canTransition, canAcceptPhoto,
  imageHash, allowedActionsFor, buildSessionResponse,
};
