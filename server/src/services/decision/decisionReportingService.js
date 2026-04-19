/**
 * decisionReportingService.js — bundles everything the decision
 * engine knows into a single snapshot object for dashboards and
 * dev panels.
 *
 * buildDecisionEngineSnapshot({
 *   events,
 *   signalsByType,       // { [signalType]: samples[] } — for confidence summary
 *   signalsByContext,    // { [contextKey]: signals[] } — for arbitration
 *   reasonHistory,
 *   pipelineResults,     // last N pipeline outputs (optional)
 *   listing,             // listing context (optional)
 *   confidences,         // { location, recommendation, task, listing }
 * })
 *
 * Callers may supply only some inputs — every missing section is
 * silently empty so the UI never crashes on partial data.
 *
 * Returns:
 *   {
 *     pipeline:       { stageOrder, recent: [...] },
 *     confidenceSummary,      // buildSignalConfidenceSummary
 *     arbitration:    ArbitrationResult[],
 *     journey:        JourneyHealthSnapshot,
 *     actionability:  full plan,
 *     responses:      applyRecoveryPlan output,
 *     reasons:        summarizeTopReasons,
 *     generatedAt:    number,
 *   }
 */

import { PIPELINE_STAGE_ORDER } from './pipelinePriority.js';
import { buildSignalConfidenceSummary } from './signalConfidence.js';
import { scoreAllContexts } from './signalArbitration.js';
import { buildJourneyHealthSnapshot } from './journeyHealthService.js';
import { buildActionabilityPlan } from './actionabilityService.js';
import { applyRecoveryPlan } from './responseApplicationService.js';
import {
  summarizeTopReasons,
} from './reasonHistoryService.js';

export function buildDecisionEngineSnapshot({
  events = [],
  signalsByType = {},
  signalsByContext = {},
  reasonHistory = [],
  pipelineResults = [],
  listing = null,
  confidences = {},
  contextKey = null,
  now = Date.now(),
} = {}) {
  const confidenceSummary = buildSignalConfidenceSummary({ signals: signalsByType, now });
  const arbitration = scoreAllContexts(signalsByContext);
  const journey = buildJourneyHealthSnapshot(events, { now });
  const actionabilityCtx = {
    contextKey,
    journey,
    locationConfidence:       confidences.location || null,
    recommendationConfidence: confidences.recommendation || null,
    taskConfidence:           confidences.task || null,
    listingConfidence:        confidences.listing || null,
    listing: listing || null,
  };
  const actionability = buildActionabilityPlan(actionabilityCtx);
  const responses = applyRecoveryPlan(actionability);
  const topReasons = summarizeTopReasons(reasonHistory, { now });

  return {
    generatedAt: now,
    pipeline: {
      stageOrder: PIPELINE_STAGE_ORDER,
      recent: (Array.isArray(pipelineResults) ? pipelineResults : []).slice(-5).map(shrinkPipelineResult),
    },
    confidenceSummary,
    arbitration,
    journey,
    actionability,
    responses,
    reasons: topReasons,
  };
}

/**
 * buildPipelineTraceReport — just the pipeline trace portion.
 * Useful when a dashboard only needs to surface the execution
 * path of a single decision.
 */
export function buildPipelineTraceReport(pipelineResult) {
  if (!pipelineResult) return null;
  return {
    kind: pipelineResult.kind,
    contextKey: pipelineResult.contextKey,
    explanation: pipelineResult.explanation || [],
    trace: (pipelineResult.trace || []).map((t) => ({
      stage: t.stage,
      priority: t.priority,
      changes: t.changes || [],
      elapsedMs: t.elapsedMs,
      error: t.error || null,
    })),
    locks: Object.entries(pipelineResult.locks || {}).map(([k, v]) => ({ path: k, ...v })),
    finalConfidence: pipelineResult.confidence || null,
    finalWording: pipelineResult.wordingKeys || {},
  };
}

function shrinkPipelineResult(r) {
  return {
    kind: r.kind,
    contextKey: r.contextKey,
    trace: (r.trace || []).map((t) => ({ stage: t.stage, changes: t.changes || [] })),
    explanation: r.explanation || [],
    confidence: r.confidence || null,
    lockCount: Object.keys(r.locks || {}).length,
  };
}
