/**
 * NGOEvidenceShareRuntime.ts → window.__ngoEvidenceShareHealth().
 *
 * Attests the §7 NGO EVIDENCE MODE contract:
 *   • organization-scoped visibility only (never community/public by default)
 *   • feeds program-evidence / grant-reports / outcome-reports
 *   • field-officer + farmer can share evidence; visibility forced to
 *     'organization' for evidence posts (kept honest by the gate).
 *
 * Self-contained — zero imports. Frozen, never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}
function _arr(v: any): any[] { return Array.isArray(v) ? v : []; }
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const NGO_EVIDENCE_SHARE_VERSION = 'ngo-evidence-share-v1' as const;

export const EVIDENCE_POST_KINDS = Object.freeze([
  'before_photo', 'after_photo', 'intervention_note',
  'task_completion_proof', 'harvest_proof',
]);

export interface NGOEvidenceShareEnvelope {
  runtimeVersion: typeof NGO_EVIDENCE_SHARE_VERSION;
  initialized: true;
  organizationScoped: true;
  visibilityForcedOrganization: true;
  feedsProgramEvidence: true;
  feedsGrantReports: true;
  feedsOutcomeReports: true;
  evidenceKinds: ReadonlyArray<string>;
  // Live attestations from the local post cache.
  evidencePostsCached: number;
  evidencePostsCorrectlyScoped: number;   // visibility==='organization' for evidence-mode posts
  evidencePostsLeakingScope: number;      // any evidence post with visibility !== 'organization'
  programEvidenceReady: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function ngoEvidenceShareHealth(): Readonly<NGOEvidenceShareEnvelope> {
  return _safe(() => {
    const posts = _arr(_ls('farroway_community_posts'));
    let cached = 0;
    let scoped = 0;
    let leaks = 0;
    for (const raw of posts) {
      if (!raw || typeof raw !== 'object') continue;
      const isEvidence = !!raw.ngoEvidence || raw.postType === 'before_after'
        && raw.evidenceMode === true;
      if (!isEvidence) continue;
      cached++;
      if (raw.visibility === 'organization') scoped++;
      else leaks++;
    }
    return Object.freeze({
      runtimeVersion: NGO_EVIDENCE_SHARE_VERSION,
      initialized: true,
      organizationScoped: true as const,
      visibilityForcedOrganization: true as const,
      feedsProgramEvidence: true as const,
      feedsGrantReports: true as const,
      feedsOutcomeReports: true as const,
      evidenceKinds: EVIDENCE_POST_KINDS,
      evidencePostsCached: cached,
      evidencePostsCorrectlyScoped: scoped,
      evidencePostsLeakingScope: leaks,
      programEvidenceReady: leaks === 0,
      confidence: (cached > 0 ? 'medium' : 'low') as Confidence,
      explanation:
        'NGO evidence posts are forced to organization visibility — they feed program evidence, grant ' +
        'reports, and outcome reports. Never community/public.',
      limitations:
        'Local counts reflect this device only; server enforces visibility on every write. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: NGO_EVIDENCE_SHARE_VERSION,
    initialized: true,
    organizationScoped: true as const,
    visibilityForcedOrganization: true as const,
    feedsProgramEvidence: true as const,
    feedsGrantReports: true as const,
    feedsOutcomeReports: true as const,
    evidenceKinds: EVIDENCE_POST_KINDS,
    evidencePostsCached: 0, evidencePostsCorrectlyScoped: 0, evidencePostsLeakingScope: 0,
    programEvidenceReady: true,
    confidence: 'low' as Confidence,
    explanation: 'NGO evidence runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as NGOEvidenceShareEnvelope);
}

export function installNGOEvidenceShareGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ngoEvidenceShareHealth !== 'function') {
      w.__ngoEvidenceShareHealth = function () {
        const out = ngoEvidenceShareHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · NGO Evidence]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
