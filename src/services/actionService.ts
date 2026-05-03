/**
 * actionService.ts — daily action loader + completion sender
 * for the Calm-UI Home screen.
 *
 *   import { getTodayAction, completeAction } from '../services/actionService';
 *
 * Endpoints
 *   GET  /api/actions/today      → AI Task Engine envelope
 *   POST /api/actions/complete   → server-acknowledged tap
 *
 * Behaviour
 *   • Both calls go through `apiClient` so auth + base URL are
 *     resolved consistently with the rest of the services layer.
 *   • Failures NEVER throw to the caller. `getTodayAction` falls
 *     back to the spec literal:
 *       backyard → "Check your plant today" / "Check now"
 *       farmer   → "Check your crop today" / "Check crop"
 *     `completeAction` swallows errors silently — the local UI
 *     state is the source of truth for the "Done" animation.
 *
 * Strict-rule audit
 *   • Pure async functions — never read the DOM, never write to
 *     localStorage, never read `window.*` globals.
 *   • Returned envelope shape is a SUPERSET of the AI Task
 *     Engine v1 envelope so callers consuming the existing
 *     /api/tasks/today response can swap to /api/actions/today
 *     without rewriting their render path.
 */

import { apiClient } from './apiClient';

export type Urgency = 'low' | 'medium' | 'high';

export type TodayActionEnvelope = {
  // Spec fields
  todayTaskTitle:      string;
  taskReason:          string;
  urgency:             Urgency;
  estimatedTime:       string;
  safetyNote:          string | null;
  localizedText: {
    title:            string | null;
    reason:           string | null;
    safetyNote:       string | null;
    completionPrompt: string;
  };
  nextRecommendedTask: string;
  completionPrompt:    string;
  // Diagnostics (the engine returns these for auditability)
  ruleId?:    string;
  userType?:  'farmer' | 'backyard';
  fallback?:  boolean;
  language?:  string;
  generatedAt?: string;
  // Convenience CTA label the spec asks for as a top-level
  // field. We fill it from urgency + userType heuristics so
  // the caller doesn't have to.
  cta?: string;
};

const FALLBACK_BACKYARD: TodayActionEnvelope = {
  todayTaskTitle: 'Check your plant today',
  taskReason:     'Do a quick visual check.',
  urgency:        'low',
  estimatedTime:  '20 sec',
  safetyNote:     null,
  localizedText: {
    title: null, reason: null, safetyNote: null,
    completionPrompt: 'Nice \u2014 you stayed ahead today \uD83C\uDF31',
  },
  nextRecommendedTask: 'Check again tomorrow morning',
  completionPrompt:    'Nice \u2014 you stayed ahead today \uD83C\uDF31',
  cta:                 'Check now',
  fallback:            true,
  ruleId:              'local_fallback',
  userType:            'backyard',
};

const FALLBACK_FARMER: TodayActionEnvelope = {
  todayTaskTitle: 'Check your crop today',
  taskReason:     'Look for damage or unusual color.',
  urgency:        'low',
  estimatedTime:  '2 min',
  safetyNote:     null,
  localizedText: {
    title: null, reason: null, safetyNote: null,
    completionPrompt: 'Nice \u2014 you reduced risk today \uD83D\uDE9C',
  },
  nextRecommendedTask: 'Check again tomorrow morning',
  completionPrompt:    'Nice \u2014 you reduced risk today \uD83D\uDE9C',
  cta:                 'Check crop',
  fallback:            true,
  ruleId:              'local_fallback',
  userType:            'farmer',
};

/**
 * getTodayAction({ userType?, language? }) → TodayActionEnvelope
 *
 * Returns the spec fallback when the server is unreachable.
 */
export async function getTodayAction(
  opts: { userType?: 'farmer' | 'backyard'; language?: string } = {},
): Promise<TodayActionEnvelope> {
  const params = new URLSearchParams();
  if (opts.userType) params.set('userType', opts.userType);
  if (opts.language) params.set('language', opts.language);
  const qs = params.toString();
  const path = qs ? `/api/actions/today?${qs}` : '/api/actions/today';
  try {
    const res = await apiClient<TodayActionEnvelope>(path);
    if (!res || typeof res !== 'object' || !res.todayTaskTitle) {
      return _buildFallback(opts.userType);
    }
    // Synthesise a CTA when the server didn't provide one.
    return { ...res, cta: res.cta || _resolveCta(res) };
  } catch {
    return _buildFallback(opts.userType);
  }
}

/**
 * completeAction({ ruleId?, taskId?, source? }) → { ok: boolean }
 *
 * Fire-and-forget server acknowledgement. Caller does NOT need
 * to await this for the UI's Done-state transition — the local
 * state is the source of truth. Always resolves; never throws.
 */
export async function completeAction(input: {
  ruleId?: string;
  taskId?: string;
  source?: string;
} = {}): Promise<{ ok: boolean }> {
  try {
    await apiClient<{ ok: boolean }>('/api/actions/complete', {
      method: 'POST',
      body: {
        ruleId: input.ruleId,
        taskId: input.taskId,
        source: input.source || 'home_today_card',
      },
    });
    return { ok: true };
  } catch {
    // Silent — the spec mandates the UI never blocks on completion.
    return { ok: false };
  }
}

function _buildFallback(userType?: 'farmer' | 'backyard'): TodayActionEnvelope {
  return userType === 'backyard' ? { ...FALLBACK_BACKYARD } : { ...FALLBACK_FARMER };
}

function _resolveCta(env: TodayActionEnvelope): string {
  if (env.userType === 'backyard') return 'Check now';
  // Default to "Check crop" for farmer; high-urgency rules can
  // surface stronger CTAs on a per-rule basis in v2.
  return 'Check crop';
}

// Re-exported for tests + advanced callers that want to inspect
// the canonical fallback shape.
export const _internal = Object.freeze({
  FALLBACK_BACKYARD,
  FALLBACK_FARMER,
  _resolveCta,
});

export default getTodayAction;
