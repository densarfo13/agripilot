/**
 * actionableInsights.js — turn a cluster into a one-line "what
 * the NGO operator should DO" hint.
 *
 *   getInsightForCluster(cluster)     -> { messageKey, fallback, severity }
 *   getInsightsForFarms(farms, clusters, opts?)
 *                                     -> Array<Insight>
 *
 * Pure, deterministic, never throws.
 *
 * Strict-rule audit:
 *   * pure: no I/O, no globals
 *   * never throws on missing inputs
 *   * lightweight: small lookup tables
 */

const PEST_HINT = Object.freeze({
  HIGH: {
    messageKey: 'ngo.action.pestSendAgents',
    fallback:   'Send field agents to inspect farms',
    severity:   'high',
  },
  MEDIUM: {
    messageKey: 'ngo.action.pestWatch',
    fallback:   'Watch for pest spread; advise farmer scouting',
    severity:   'medium',
  },
});

const DROUGHT_HINT = Object.freeze({
  HIGH: {
    messageKey: 'ngo.action.droughtIrrigation',
    fallback:   'Advise irrigation or water support',
    severity:   'high',
  },
  MEDIUM: {
    messageKey: 'ngo.action.droughtMonitor',
    fallback:   'Monitor rainfall; remind farmers to water',
    severity:   'medium',
  },
});

const INACTIVITY_HINT = Object.freeze({
  messageKey: 'ngo.action.farmersInactive',
  fallback:   'Farmers are not checking crops; reach out',
  severity:   'medium',
});

/**
 * getInsightForCluster(cluster)
 *
 * Returns the recommended action for an outbreak cluster, or
 * null when nothing actionable applies. Caller renders the
 * insight inline next to the cluster row.
 */
export function getInsightForCluster(cluster) {
  if (!cluster || typeof cluster !== 'object') return null;
  const sev = String(cluster.severity || '').toUpperCase();
  const issue = String(cluster.issueType || '').toLowerCase();

  if (issue === 'pest') {
    return PEST_HINT[sev] || null;
  }
  // 'disease' clusters get the same field-agents recommendation
  // as pests for v1; specialised disease guidance is a v2 task.
  if (issue === 'disease') {
    return PEST_HINT[sev] || null;
  }
  return null;
}

/**
 * getInsightForRisks(risks)
 *
 * Returns a hint for the farmer-side {drought, pest} risks
 * record produced by computeFarmRisks(). Pest tie-breaks
 * drought (matches the priority pick in riskEngine).
 */
export function getInsightForRisks(risks) {
  if (!risks || typeof risks !== 'object') return null;
  if (risks.pest === 'HIGH' || risks.pest === 'MEDIUM') {
    return PEST_HINT[risks.pest];
  }
  if (risks.drought === 'HIGH' || risks.drought === 'MEDIUM') {
    return DROUGHT_HINT[risks.drought];
  }
  return null;
}

/**
 * inactivityHint() — the "farmers not checking" line. Caller
 * decides when to surface (e.g. low-activity NGO alert from
 * the Farroway core ngoAlerts module).
 */
export function inactivityHint() { return INACTIVITY_HINT; }

export const ACTION_HINTS = Object.freeze({
  PEST_HINT, DROUGHT_HINT, INACTIVITY_HINT,
});
