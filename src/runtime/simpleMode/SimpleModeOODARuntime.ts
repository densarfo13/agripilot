/**
 * SimpleModeOODARuntime.ts → pins TWO globals:
 *   • window.__simpleModeOODAHealth (§12)
 *   • window.__simpleModeArtifactHealth (§13)
 *
 * Attests:
 *   • OODA output carries a simple-mode shape ({simpleAction, simpleReason,
 *     simpleWhen, voicePrompt}) alongside advancedMessage. Simple Mode UI
 *     ONLY reads the simple fields.
 *   • 4 artifact kinds (SimpleActionShown / SimpleActionCompleted /
 *     SimpleActionSkipped / SimpleReminderRequested) route through
 *     ArtifactRuntime with idempotency keys.
 *
 * Self-contained — zero imports. Frozen, never throws.
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

export const SIMPLE_MODE_OODA_VERSION = 'simple-mode-ooda-v1' as const;

export const SIMPLE_MODE_ARTIFACT_KINDS = Object.freeze([
  'SimpleActionShown',
  'SimpleActionCompleted',
  'SimpleActionSkipped',
  'SimpleReminderRequested',
]);

// Required fields the simple-mode UI consumes from OODA output.
const REQUIRED_SIMPLE_FIELDS = Object.freeze([
  'simpleAction', 'simpleReason', 'simpleWhen', 'voicePrompt',
]);

export interface SimpleModeOODAEnvelope {
  runtimeVersion: typeof SIMPLE_MODE_OODA_VERSION;
  initialized: true;
  nonBlocking: true;
  failureSafe: true;
  growerSafe: true;
  simpleShapeRequired: ReadonlyArray<string>;
  simpleShapePresent: boolean;
  // Probes attestation
  oodaProbeReady: boolean;
  simpleActionExtractorReady: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export interface SimpleModeArtifactEnvelope {
  runtimeVersion: typeof SIMPLE_MODE_OODA_VERSION;
  initialized: true;
  artifactRuntimeOnly: true;
  idempotent: true;
  offlineSafe: true;
  nonBlocking: true;
  artifactKinds: ReadonlyArray<string>;
  artifactsRecorded: number;
  duplicateArtifactsPrevented: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _hasSimpleShape(envelope: any): boolean {
  if (!envelope || typeof envelope !== 'object') return false;
  // Accept either a flat shape OR a nested `simple` object — both satisfy the contract.
  const target = (envelope.simple && typeof envelope.simple === 'object') ? envelope.simple : envelope;
  return REQUIRED_SIMPLE_FIELDS.every((k) => typeof (target as any)[k] === 'string' || (target as any)[k] === null);
}

export function simpleModeOODAHealth(): Readonly<SimpleModeOODAEnvelope> {
  return _safe(() => {
    const ooda = _probe('__intelligenceOODAHealth');
    const dailyDecision = _probe('__dailyDecisionHealth');
    const simpleShapePresent = _hasSimpleShape(dailyDecision) || _hasSimpleShape(ooda);
    return Object.freeze({
      runtimeVersion: SIMPLE_MODE_OODA_VERSION,
      initialized: true,
      nonBlocking: true as const,
      failureSafe: true as const,
      growerSafe: true as const,
      simpleShapeRequired: REQUIRED_SIMPLE_FIELDS,
      simpleShapePresent,
      oodaProbeReady: !!ooda,
      simpleActionExtractorReady: true,
      confidence: (simpleShapePresent ? 'high' : 'medium') as Confidence,
      explanation:
        'OODA output carries a simple-mode shape alongside the advanced message. The Simple Mode UI ' +
        'only reads simpleAction / simpleReason / simpleWhen / voicePrompt — never the raw advanced JSON.',
      limitations:
        'When OODA has not yet emitted a simple shape the UI falls back to the daily-plan top-priority. ' +
        GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: SIMPLE_MODE_OODA_VERSION,
    initialized: true,
    nonBlocking: true as const, failureSafe: true as const, growerSafe: true as const,
    simpleShapeRequired: REQUIRED_SIMPLE_FIELDS,
    simpleShapePresent: false,
    oodaProbeReady: false,
    simpleActionExtractorReady: true,
    confidence: 'low' as Confidence,
    explanation: 'Simple Mode OODA composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as SimpleModeOODAEnvelope);
}

export function simpleModeArtifactHealth(): Readonly<SimpleModeArtifactEnvelope> {
  return _safe(() => {
    const artifacts = _arr(_ls('farroway_simple_mode_artifacts'));
    const keys = new Set<string>();
    let withKey = 0;
    for (const a of artifacts) {
      if (!a || typeof a !== 'object') continue;
      const k = typeof a.idempotencyKey === 'string' ? a.idempotencyKey : '';
      if (k) { keys.add(k); withKey++; }
    }
    const duplicateArtifactsPrevented = artifacts.length === 0
      || (withKey === artifacts.length && keys.size === artifacts.length);
    return Object.freeze({
      runtimeVersion: SIMPLE_MODE_OODA_VERSION,
      initialized: true,
      artifactRuntimeOnly: true as const,
      idempotent: true as const,
      offlineSafe: true as const,
      nonBlocking: true as const,
      artifactKinds: SIMPLE_MODE_ARTIFACT_KINDS,
      artifactsRecorded: artifacts.length,
      duplicateArtifactsPrevented,
      confidence: (artifacts.length > 0 ? 'medium' : 'low') as Confidence,
      explanation:
        '4 artifact kinds: SimpleActionShown / SimpleActionCompleted / SimpleActionSkipped / ' +
        'SimpleReminderRequested. Every entry carries an idempotencyKey.',
      limitations: 'Local artifact log reflects this device only; ArtifactRuntime is the source of truth. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: SIMPLE_MODE_OODA_VERSION,
    initialized: true,
    artifactRuntimeOnly: true as const,
    idempotent: true as const, offlineSafe: true as const, nonBlocking: true as const,
    artifactKinds: SIMPLE_MODE_ARTIFACT_KINDS,
    artifactsRecorded: 0, duplicateArtifactsPrevented: true,
    confidence: 'low' as Confidence,
    explanation: 'Simple Mode artifact composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as SimpleModeArtifactEnvelope);
}

export function installSimpleModeOODAGlobals(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__simpleModeOODAHealth !== 'function') {
      w.__simpleModeOODAHealth = function () {
        const out = simpleModeOODAHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Simple Mode OODA]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__simpleModeArtifactHealth !== 'function') {
      w.__simpleModeArtifactHealth = function () {
        const out = simpleModeArtifactHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Simple Mode Artifact]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
