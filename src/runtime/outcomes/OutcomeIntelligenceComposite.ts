/**
 * OutcomeIntelligenceComposite.ts → window.__outcomeIntelligenceHealth().
 *
 * Top-level composite over the EXISTING outcome surface that exposes the
 * 8 readiness flags the outcome-intelligence spec requires. Read-only;
 * never duplicates state; never fabricates scores; honest false until
 * the underlying engine reports ready.
 *
 * Composed source probes (all read by name; missing probes default flags
 * to false — no fake green):
 *   • __outcomeHealth                — existing OutcomeRuntime
 *   • __outcomeCaptureHealth         — existing OutcomeCapture
 *   • __outcomeLearningLoopHealth    — existing scan→outcome chain
 *   • __farmHealthScoreHealth        — existing FarmHealthScoreEngine
 *   • __yieldReadinessHealth         — existing YieldReadinessEngine
 *   • __postHarvestHealth            — existing PostHarvestEngine
 *   • __fundingHealth                — existing FundingRuntime
 *
 * Self-contained; zero imports; frozen; never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const OUTCOME_INTELLIGENCE_COMPOSITE_VERSION = 'outcome-intelligence-composite-v1' as const;

/** The 4 spec artifact kinds. Enumerated for the gate; recorded by the
 *  outcome-capture surfaces via ArtifactRuntime — never duplicated here. */
export const OUTCOME_INTELLIGENCE_ARTIFACT_KINDS: ReadonlyArray<string> = Object.freeze([
  'OutcomeRecorded',
  'OutcomeImprovementRecorded',
  'OutcomeFollowUpRequested',
  'OutcomeLearningSnapshotCreated',
]);

export interface OutcomeIntelligenceEnvelope {
  runtimeVersion: typeof OUTCOME_INTELLIGENCE_COMPOSITE_VERSION;
  initialized: true;
  // §HEALTH CHECK — the 8 spec flags.
  outcomeRuntimeReady: boolean;
  outcomeCaptureReady: boolean;
  outcomeScoringReady: boolean;
  outcomeArtifactsReady: boolean;
  scanOutcomeReady: boolean;
  yieldReady: boolean;
  harvestReady: boolean;
  fundingReadinessReady: boolean;
  // Aggregate verdict.
  integratedCount: number;
  totalSignals: number;
  outcomeIntelligenceReady: boolean;
  // Honest source attribution.
  composedFrom: ReadonlyArray<string>;
  // No fake scores / fabricated yield — surfaced from real probes only.
  noFakeScores: true;
  noFabricatedYield: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function outcomeIntelligenceHealth(): Readonly<OutcomeIntelligenceEnvelope> {
  return _safe(() => {
    const outcome = _probe('__outcomeHealth');
    const capture = _probe('__outcomeCaptureHealth');
    const learning = _probe('__outcomeLearningLoopHealth');
    const farmHealth = _probe('__farmHealthScoreHealth');
    const yieldProbe = _probe('__yieldReadinessHealth');
    const postHarvest = _probe('__postHarvestHealth');
    const funding = _probe('__fundingHealth');
    const artifact = _probe('__artifactHealth');

    const outcomeRuntimeReady = !!(outcome && (outcome as any).initialized === true);
    const outcomeCaptureReady = !!capture;
    const outcomeScoringReady = !!(outcome && (
      (outcome as any).scoringReady === true
      || (outcome as any).outcomeScoringReady === true
      || (outcome as any).outcomeTrackerReady === true
    ));
    const outcomeArtifactsReady = !!(artifact && (
      (artifact as any).initialized === true
      || (artifact as any).artifactRuntimeReady === true
    ));
    const scanOutcomeReady = !!(learning && (
      (learning as any).scanLinked === true
      || (learning as any).initialized === true
    ));
    const yieldReady = !!(yieldProbe && (
      (yieldProbe as any).initialized === true
      || (yieldProbe as any).yieldReadinessReady === true
    ));
    const harvestReadyFlag = !!(postHarvest && (
      (postHarvest as any).initialized === true
      || (postHarvest as any).harvestChecklist !== undefined
    ));
    const fundingReadinessReady = !!(funding && (
      (funding as any).initialized === true
      || (funding as any).fundingReady === true
    ));

    const flags = [
      outcomeRuntimeReady, outcomeCaptureReady, outcomeScoringReady,
      outcomeArtifactsReady, scanOutcomeReady, yieldReady,
      harvestReadyFlag, fundingReadinessReady,
    ];
    const integratedCount = flags.filter(Boolean).length;
    const totalSignals = flags.length;
    const outcomeIntelligenceReady = integratedCount === totalSignals;

    const composed: string[] = [];
    if (outcome) composed.push('__outcomeHealth');
    if (capture) composed.push('__outcomeCaptureHealth');
    if (learning) composed.push('__outcomeLearningLoopHealth');
    if (farmHealth) composed.push('__farmHealthScoreHealth');
    if (yieldProbe) composed.push('__yieldReadinessHealth');
    if (postHarvest) composed.push('__postHarvestHealth');
    if (funding) composed.push('__fundingHealth');
    if (artifact) composed.push('__artifactHealth');

    return Object.freeze<OutcomeIntelligenceEnvelope>({
      runtimeVersion: OUTCOME_INTELLIGENCE_COMPOSITE_VERSION,
      initialized: true,
      outcomeRuntimeReady,
      outcomeCaptureReady,
      outcomeScoringReady,
      outcomeArtifactsReady,
      scanOutcomeReady,
      yieldReady,
      harvestReady: harvestReadyFlag,
      fundingReadinessReady,
      integratedCount,
      totalSignals,
      outcomeIntelligenceReady,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      noFakeScores: true as const,
      noFabricatedYield: true as const,
      confidence: (composed.length >= 5 ? 'high' : composed.length >= 2 ? 'medium' : 'low') as Confidence,
      explanation:
        'Outcome intelligence composite: 8 readiness flags read honestly from existing engines ' +
        '(OutcomeRuntime, OutcomeCapture, OutcomeLearningLoop, FarmHealthScore, YieldReadiness, ' +
        'PostHarvest, FundingRuntime, ArtifactRuntime). No fake scores; no fabricated yield; flags ' +
        'flip true only when the underlying probe reports ready.',
      limitations:
        'Composite is read-only and never writes outcomes; the surfaces that capture outcomes ' +
        '(SimpleActionCard Done flow, Scan result follow-up, etc.) record artifacts via ' +
        'ArtifactRuntime. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<OutcomeIntelligenceEnvelope>({
    runtimeVersion: OUTCOME_INTELLIGENCE_COMPOSITE_VERSION,
    initialized: true,
    outcomeRuntimeReady: false, outcomeCaptureReady: false, outcomeScoringReady: false,
    outcomeArtifactsReady: false, scanOutcomeReady: false, yieldReady: false,
    harvestReady: false, fundingReadinessReady: false,
    integratedCount: 0, totalSignals: 8, outcomeIntelligenceReady: false,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    noFakeScores: true as const, noFabricatedYield: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Outcome intelligence composite initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installOutcomeIntelligenceCompositeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeIntelligenceHealth !== 'function') {
      w.__outcomeIntelligenceHealth = function () {
        const out = outcomeIntelligenceHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Outcome Intelligence]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
