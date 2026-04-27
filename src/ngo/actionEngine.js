/**
 * actionEngine.js — turn a region insight row into a short list
 * of NGO-readable actions.
 *
 *   generateActions(regionInsight)
 *     -> Array<{ messageKey, fallback, severity, kind }>
 *
 * Pure, deterministic. No raw model output ever appears in the
 * action lines - the whole point of this module is to translate
 * scores into human-readable next steps.
 *
 * Strict-rule audit
 *   * Doesn't expose ML internals.
 *   * Pure.
 *   * Lightweight: a handful of threshold checks.
 */

const PEST_THRESHOLD       = 5;   // farms at HIGH pest risk
const DROUGHT_THRESHOLD    = 5;   // farms at HIGH drought risk
const PEST_REPORT_FLOOR    = 3;   // outbreak-engine activation
const LOW_LABEL_THRESHOLD  = 3;   // confidence is LOW under this

const ACTION = Object.freeze({
  PEST_DEPLOY:          { messageKey: 'ngo.action.pestSendAgents',
                          fallback:   'Deploy pest control support',
                          severity:   'high',  kind: 'pest' },
  PEST_WATCH:           { messageKey: 'ngo.action.pestWatch',
                          fallback:   'Watch for pest spread; advise farmer scouting',
                          severity:   'medium', kind: 'pest' },
  DROUGHT_IRRIGATE:     { messageKey: 'ngo.action.droughtIrrigation',
                          fallback:   'Advise irrigation or water support',
                          severity:   'high',  kind: 'drought' },
  DROUGHT_MONITOR:      { messageKey: 'ngo.action.droughtMonitor',
                          fallback:   'Monitor rainfall; remind farmers to water',
                          severity:   'medium', kind: 'drought' },
  COLLECT_MORE_LABELS:  { messageKey: 'ngo.action.collectLabels',
                          fallback:   'Visit farmers to collect more reports',
                          severity:   'low',   kind: 'data' },
});

/**
 * generateActions(regionInsight)
 *
 * regionInsight is the row shape produced by
 * src/ngo/insightsEngine.computeRegionInsights.
 */
export function generateActions(regionInsight) {
  if (!regionInsight || typeof regionInsight !== 'object') return [];
  const out = [];

  const pestHigh    = Number(regionInsight.pestHigh)    || 0;
  const pestMed     = Number(regionInsight.pestMedium)  || 0;
  const droughtHigh = Number(regionInsight.droughtHigh) || 0;
  const droughtMed  = Number(regionInsight.droughtMedium) || 0;
  const reportCount = Number(regionInsight.reportCount) || 0;
  const labelCount  = Number(regionInsight.labelCount)  || 0;

  // High-priority actions first.
  if (pestHigh >= PEST_THRESHOLD)             out.push(ACTION.PEST_DEPLOY);
  if (droughtHigh >= DROUGHT_THRESHOLD)       out.push(ACTION.DROUGHT_IRRIGATE);

  // Mid-priority watch lines for clusters that haven't crossed
  // the deploy threshold yet but are showing real signal.
  if (pestHigh < PEST_THRESHOLD && pestHigh > 0)         out.push(ACTION.PEST_WATCH);
  else if (reportCount >= PEST_REPORT_FLOOR && pestHigh === 0
           && pestMed >= 1)                              out.push(ACTION.PEST_WATCH);
  if (droughtHigh < DROUGHT_THRESHOLD && droughtHigh > 0) out.push(ACTION.DROUGHT_MONITOR);
  else if (droughtMed >= 2 && droughtHigh === 0)          out.push(ACTION.DROUGHT_MONITOR);

  // Data-quality nudge: if a region shows risk but the label
  // count is below the LOW threshold, ask the field team to
  // collect more confirmations.
  const showsRisk = (pestHigh + droughtHigh + pestMed + droughtMed) >= 1;
  if (showsRisk && labelCount < LOW_LABEL_THRESHOLD) out.push(ACTION.COLLECT_MORE_LABELS);

  return out;
}

export const ACTIONS = ACTION;
export const _internal = Object.freeze({
  PEST_THRESHOLD, DROUGHT_THRESHOLD,
  PEST_REPORT_FLOOR, LOW_LABEL_THRESHOLD,
});
