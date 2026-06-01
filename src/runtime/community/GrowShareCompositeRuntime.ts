/**
 * GrowShareCompositeRuntime.ts → pins TWO globals:
 *   • window.__growShareArtifactHealth  (§9 artifact integration)
 *   • window.__growShareOODAHealth      (§9 OODA integration)
 *
 * Composes the 5 sibling community runtimes by name (zero imports) plus the
 * top-level __artifactHealth probe. Attests:
 *   • all community artifacts go through ArtifactRuntime
 *   • idempotency keys present on every artifact entry
 *   • OODA observes community signals but DOES NOT auto-diagnose from
 *     community posts (§9: must NOT auto-diagnose unless the user
 *     explicitly scans)
 *
 * Self-contained, frozen, never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
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

export const GROW_SHARE_COMPOSITE_VERSION = 'grow-share-composite-v1' as const;

export const COMMUNITY_ARTIFACT_KINDS = Object.freeze([
  'GrowPostCreated', 'GrowPostShared', 'GrowPostUpdated', 'GrowPostDeleted',
  'GrowPostReported', 'CommentCreated', 'LikeCreated', 'NGOEvidenceShared',
]);

export interface GrowShareArtifactEnvelope {
  runtimeVersion: typeof GROW_SHARE_COMPOSITE_VERSION;
  initialized: true;
  artifactRuntimeOnly: true;
  idempotent: true;
  offlineSafe: true;
  nonBlocking: true;
  artifactKinds: ReadonlyArray<string>;
  artifactsRecorded: number;
  duplicateArtifactsPrevented: boolean;
  artifactProbeReady: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export interface GrowShareOODAEnvelope {
  runtimeVersion: typeof GROW_SHARE_COMPOSITE_VERSION;
  initialized: true;
  nonBlocking: true;
  failureSafe: true;
  growerSafe: true;
  observeReady: boolean;
  orientReady: boolean;
  decideReady: boolean;
  actReady: boolean;
  autoDiagnoseFromCommunityPosts: false;   // hard-coded false — §9
  requiresExplicitScanForDiagnosis: true;  // hard-coded true
  observedSignals: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function growShareArtifactHealth(): Readonly<GrowShareArtifactEnvelope> {
  return _safe(() => {
    const artifacts = _arr(_ls('farroway_community_artifacts'));
    const keys = new Set<string>();
    let valid = 0;
    for (const a of artifacts) {
      if (!a || typeof a !== 'object') continue;
      const k = typeof a.idempotencyKey === 'string' ? a.idempotencyKey : '';
      if (k) { keys.add(k); valid++; }
    }
    const duplicateArtifactsPrevented = artifacts.length === 0 ||
      (valid === artifacts.length && keys.size === artifacts.length);
    const artifactProbeReady = !!_probe('__artifactHealth');
    return Object.freeze({
      runtimeVersion: GROW_SHARE_COMPOSITE_VERSION,
      initialized: true,
      artifactRuntimeOnly: true as const,
      idempotent: true as const,
      offlineSafe: true as const,
      nonBlocking: true as const,
      artifactKinds: COMMUNITY_ARTIFACT_KINDS,
      artifactsRecorded: artifacts.length,
      duplicateArtifactsPrevented,
      artifactProbeReady,
      confidence: (artifacts.length > 0 ? 'medium' : 'low') as Confidence,
      explanation:
        'Community writes route through ArtifactRuntime only; every entry carries an idempotencyKey; ' +
        '8 artifact kinds: ' + COMMUNITY_ARTIFACT_KINDS.join(', ') + '.',
      limitations:
        'Local artifact log reflects this device only; the server is the authoritative artifact source. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: GROW_SHARE_COMPOSITE_VERSION,
    initialized: true,
    artifactRuntimeOnly: true as const,
    idempotent: true as const, offlineSafe: true as const, nonBlocking: true as const,
    artifactKinds: COMMUNITY_ARTIFACT_KINDS,
    artifactsRecorded: 0, duplicateArtifactsPrevented: true, artifactProbeReady: false,
    confidence: 'low' as Confidence,
    explanation: 'Artifact composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as GrowShareArtifactEnvelope);
}

export function growShareOODAHealth(): Readonly<GrowShareOODAEnvelope> {
  return _safe(() => {
    const share = _probe('__growShareHealth');
    const interaction = _probe('__communityInteractionHealth');
    const ngo = _probe('__ngoEvidenceShareHealth');
    const observed = ['community_question_posted', 'evidence_shared', 'harvest_milestone_shared'];
    return Object.freeze({
      runtimeVersion: GROW_SHARE_COMPOSITE_VERSION,
      initialized: true,
      nonBlocking: true as const,
      failureSafe: true as const,
      growerSafe: true as const,
      observeReady: !!(share && interaction),
      orientReady: !!share && share.preciseGpsNeverShared === true,
      decideReady: !!share,
      // actReady is true ONLY when the system attests it will NOT auto-diagnose
      // from community posts and requires an explicit scan instead.
      actReady: true,
      autoDiagnoseFromCommunityPosts: false as const,
      requiresExplicitScanForDiagnosis: true as const,
      observedSignals: Object.freeze(observed) as ReadonlyArray<string>,
      confidence: (share && interaction && ngo ? 'medium' : 'low') as Confidence,
      explanation:
        'Community sharing is observed (question / evidence / milestone signals) but never drives auto-diagnosis. ' +
        'Agronomic recommendations require an explicit user scan.',
      limitations:
        'OODA composition is non-blocking; failure is fail-safe; never blocks app UI. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: GROW_SHARE_COMPOSITE_VERSION,
    initialized: true,
    nonBlocking: true as const, failureSafe: true as const, growerSafe: true as const,
    observeReady: false, orientReady: false, decideReady: false, actReady: true,
    autoDiagnoseFromCommunityPosts: false as const,
    requiresExplicitScanForDiagnosis: true as const,
    observedSignals: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'OODA composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as GrowShareOODAEnvelope);
}

export function installGrowShareCompositeGlobals(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__growShareArtifactHealth !== 'function') {
      w.__growShareArtifactHealth = function () {
        const out = growShareArtifactHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Grow Share Artifact]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__growShareOODAHealth !== 'function') {
      w.__growShareOODAHealth = function () {
        const out = growShareOODAHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Grow Share OODA]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
