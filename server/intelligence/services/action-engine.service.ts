/**
 * Action Recommendation Engine
 *
 * Generates structured action guidance for every diagnosis result.
 * Every result MUST include what to check, where, when, and escalation conditions.
 */

export interface ActionGuidance {
  where_to_check: string;
  what_to_check: string;
  when_to_act: string;
  when_to_recheck: string;
  escalation_condition: string;
  priority: 'immediate' | 'soon' | 'routine' | 'monitor';
}

// ── Issue-specific action templates ──

const ISSUE_ACTIONS: Record<string, Partial<ActionGuidance>> = {
  pest: {
    where_to_check: 'Underside of leaves in the affected section and nearby plants within 10 meters',
    what_to_check: 'Look for bite marks, holes, visible insects, egg clusters, or frass (insect droppings)',
    escalation_condition: 'Escalate if spread increases to more than 20% of plants or new insect types appear',
  },
  disease: {
    where_to_check: 'Stems, leaf surfaces, and soil around affected plants',
    what_to_check: 'Look for discoloration patterns, wilting, lesions, mold, or unusual spots',
    escalation_condition: 'Escalate if disease spreads to adjacent rows or healthy-looking plants begin showing symptoms',
  },
  nutrient_deficiency: {
    where_to_check: 'Leaf tips, older leaves first, then newer growth across the field',
    what_to_check: 'Compare leaf color between affected and healthy areas; check for yellowing, browning, or stunted growth',
    escalation_condition: 'Escalate if deficiency symptoms appear on new growth or affect more than 30% of plants',
  },
  water_heat_stress: {
    where_to_check: 'Soil moisture at root level and exposed areas of the field',
    what_to_check: 'Check soil dryness, leaf curling, wilting patterns — worst at midday or in exposed sections',
    escalation_condition: 'Escalate if plants do not recover by morning or if wilting affects mature plants',
  },
  uncertain: {
    where_to_check: 'The most visibly affected area and compare with a healthy section nearby',
    what_to_check: 'Take clear photos of both affected and healthy plants for comparison',
    escalation_condition: 'Escalate if symptoms worsen or spread within 48 hours',
  },
};

// ── Timing by severity/risk ──

function getTimingByRisk(riskLevel: string, severity: number): { when_to_act: string; when_to_recheck: string } {
  if (riskLevel === 'urgent' || severity >= 80) {
    return { when_to_act: 'Act today — inspect immediately', when_to_recheck: 'Recheck within 24 hours' };
  }
  if (riskLevel === 'high' || severity >= 60) {
    return { when_to_act: 'Inspect within the next day', when_to_recheck: 'Recheck in 48 hours' };
  }
  if (riskLevel === 'moderate' || severity >= 40) {
    return { when_to_act: 'Plan inspection this week', when_to_recheck: 'Recheck in 5 days' };
  }
  return { when_to_act: 'Monitor during your next field visit', when_to_recheck: 'Recheck in 7 days' };
}

function getPriority(riskLevel: string, severity: number): ActionGuidance['priority'] {
  if (riskLevel === 'urgent' || severity >= 80) return 'immediate';
  if (riskLevel === 'high' || severity >= 60) return 'soon';
  if (riskLevel === 'moderate' || severity >= 40) return 'routine';
  return 'monitor';
}

/**
 * Generate action guidance for a diagnosis result.
 * Always returns complete guidance — never empty.
 */
export function generateActionGuidance(params: {
  likelyIssue: string;
  severity: number;
  riskLevel: string;
  isUncertain: boolean;
  confidenceScore: number;
}): ActionGuidance {
  const { likelyIssue, severity, riskLevel, isUncertain, confidenceScore } = params;

  const template = ISSUE_ACTIONS[likelyIssue] || ISSUE_ACTIONS.uncertain;
  const timing = getTimingByRisk(riskLevel, severity);
  const priority = getPriority(riskLevel, severity);

  let guidance: ActionGuidance = {
    where_to_check: template.where_to_check || ISSUE_ACTIONS.uncertain.where_to_check!,
    what_to_check: template.what_to_check || ISSUE_ACTIONS.uncertain.what_to_check!,
    when_to_act: timing.when_to_act,
    when_to_recheck: timing.when_to_recheck,
    escalation_condition: template.escalation_condition || ISSUE_ACTIONS.uncertain.escalation_condition!,
    priority,
  };

  // If uncertain, add extra caution
  if (isUncertain || confidenceScore < 55) {
    guidance.what_to_check += '. Since detection confidence is low, take additional close-up photos from different angles.';
    guidance.when_to_recheck = 'Recheck in 24–48 hours with new photos for a clearer assessment';
  }

  return guidance;
}

/**
 * Generate a simple farmer-friendly action summary (for alert cards).
 */
export function generateAlertActionSummary(riskLevel: string, likelyIssue: string): string {
  const issueLabel = ISSUE_LABELS[likelyIssue] || 'crop issue';
  if (riskLevel === 'urgent') return `Inspect your field immediately for signs of ${issueLabel}`;
  if (riskLevel === 'high') return `Check your crop for ${issueLabel} within 24 hours`;
  if (riskLevel === 'moderate') return `Monitor your field for ${issueLabel} this week`;
  return `Keep watching for changes in your crop`;
}

const ISSUE_LABELS: Record<string, string> = {
  pest: 'pest damage',
  disease: 'plant disease',
  nutrient_deficiency: 'nutrient problems',
  water_heat_stress: 'water or heat stress',
  uncertain: 'crop problems',
};
