/**
 * Pesticide Compliance Engine — trust layer.
 *
 * Farm-specific. Rule-based. Explainable. No AI.
 *
 * Every result is:
 *   - scoped to one farmerId (never mixes data across farms)
 *   - harvest-aware (compares last pesticide → last harvest)
 *   - traceable (last action context always exposed)
 *   - confidence-tagged (self_reported or verified)
 *
 * Evaluation priority (strict):
 *   Step 1  Completeness — missing required data → needs_review, STOP
 *   Step 2  Rule violations — broken rules → non_compliant, STOP
 *   Step 3  All clear → compliant
 *
 * Farmer-facing wording:
 *   compliant     → "Safe to harvest"
 *   needs_review  → "Check details"
 *   non_compliant → "Wait before harvesting"
 */

// ─── Default rule configuration ───────────────────────────
// Configurable: pass overrides via the `rules` param to evaluateCompliance.

export const DEFAULT_RULES = {
  minDaysBetweenApplications: 7,
  maxApplicationsPerWindow: 4,
  frequencyWindowDays: 30,
  harvestWaitingPeriodDays: 7, // min days between last pesticide and harvest
};

// Legacy exports (backward-compat for tests/consumers)
export const MIN_DAYS_BETWEEN_APPLICATIONS = DEFAULT_RULES.minDaysBetweenApplications;
export const MAX_APPLICATIONS_PER_WINDOW = DEFAULT_RULES.maxApplicationsPerWindow;
export const FREQUENCY_WINDOW_DAYS = DEFAULT_RULES.frequencyWindowDays;

// ─── Farmer-facing wording ────────────────────────────────

export const FARMER_WORDING = {
  compliant:     { label: 'Safe to harvest', action: 'Your farm is up to date.' },
  needs_review:  { label: 'Check details', action: 'Some records need attention.' },
  non_compliant: { label: 'Wait before harvesting', action: 'Wait for the safe period to pass.' },
};

// ─── Required field check ─────────────────────────────────

function checkRequiredFields(activity) {
  if (!activity.activityDate) {
    return {
      field: 'activityDate',
      activityId: activity.id,
      date: null,
      message: 'Missing timestamp on pesticide entry.',
    };
  }

  const meta = activity.metadata || {};
  const name = meta.pesticideName;
  if (!name || (typeof name === 'string' && !name.trim())) {
    return {
      field: 'pesticideName',
      activityId: activity.id,
      date: activity.activityDate,
      message: `Pesticide name missing on ${new Date(activity.activityDate).toLocaleDateString()} entry.`,
    };
  }

  return null;
}

// ─── Rule checks ──────────────────────────────────────────

function checkWaitingPeriod(sorted, minDays) {
  const violations = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].activityDate);
    const curr = new Date(sorted[i].activityDate);
    const daysBetween = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));

    if (daysBetween < minDays) {
      violations.push({
        rule: 'waiting_period',
        message: `Only ${daysBetween} day${daysBetween !== 1 ? 's' : ''} between applications (minimum ${minDays}).`,
        dates: [sorted[i - 1].activityDate, sorted[i].activityDate],
        daysBetween,
      });
    }
  }
  return violations;
}

function checkOveruse(sorted, maxPerWindow, windowDays) {
  const windowCutoff = new Date();
  windowCutoff.setDate(windowCutoff.getDate() - windowDays);

  const recentApplications = sorted.filter(a => new Date(a.activityDate) >= windowCutoff);

  if (recentApplications.length > maxPerWindow) {
    return {
      violation: {
        rule: 'excessive_frequency',
        message: `${recentApplications.length} applications in the last ${windowDays} days (maximum ${maxPerWindow}).`,
        count: recentApplications.length,
        windowDays,
        maxAllowed: maxPerWindow,
      },
      recentCount: recentApplications.length,
    };
  }

  return { violation: null, recentCount: recentApplications.length };
}

function checkHarvestSafety(lastPesticideDate, lastHarvestDate, waitDays) {
  if (!lastPesticideDate || !lastHarvestDate) return null;

  const pestDate = new Date(lastPesticideDate);
  const harvDate = new Date(lastHarvestDate);

  // Only relevant if harvest is AFTER the last pesticide
  if (harvDate <= pestDate) return null;

  const daysBetween = Math.floor((harvDate - pestDate) / (1000 * 60 * 60 * 24));

  if (daysBetween < waitDays) {
    return {
      rule: 'harvest_too_soon',
      message: `Harvest occurred ${daysBetween} day${daysBetween !== 1 ? 's' : ''} after pesticide (minimum ${waitDays}).`,
      lastPesticideDate,
      lastHarvestDate,
      daysBetween,
      requiredDays: waitDays,
    };
  }

  return null;
}

// ─── Timeline builder ─────────────────────────────────────

/**
 * Build a chronological timeline of compliance-relevant events.
 * @param {Array} pesticideActivities — pesticide FarmActivity records
 * @param {Array} harvestActivities — harvesting FarmActivity records
 * @param {number} waitDays — safe waiting period
 * @returns {Array<{ date, type, label, detail? }>}
 */
export function buildComplianceTimeline(pesticideActivities = [], harvestActivities = [], waitDays = DEFAULT_RULES.harvestWaitingPeriodDays) {
  const events = [];

  for (const act of pesticideActivities) {
    const meta = act.metadata || {};
    events.push({
      date: act.activityDate,
      type: 'pesticide',
      label: `Sprayed pesticide${meta.pesticideName ? ': ' + meta.pesticideName : ''}`,
      detail: meta.amountUsed || null,
    });

    // Add computed "safe to harvest" marker
    if (act.activityDate) {
      const safeDate = new Date(act.activityDate);
      safeDate.setDate(safeDate.getDate() + waitDays);
      events.push({
        date: safeDate.toISOString(),
        type: 'safe_date',
        label: 'Safe to harvest',
        detail: `${waitDays} days after pesticide application`,
      });
    }
  }

  for (const act of harvestActivities) {
    events.push({
      date: act.activityDate,
      type: 'harvest',
      label: 'Harvest recorded',
      detail: act.quantity ? `${act.quantity} ${act.unit || 'kg'}` : null,
    });
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  return events;
}

// ─── Confidence level ─────────────────────────────────────

/**
 * Determine confidence level for the compliance result.
 * @param {boolean} hasOfficerValidation — true if any OfficerValidation exists for this farmer's seasons
 * @returns {'self_reported' | 'verified'}
 */
export function determineConfidence(hasOfficerValidation) {
  return hasOfficerValidation ? 'verified' : 'self_reported';
}

// ─── Main evaluation ──────────────────────────────────────

/**
 * Evaluate pesticide compliance for a single farm (farmerId).
 *
 * @param {object} params
 * @param {Array}  params.pesticideActivities — FarmActivity records (activityType = 'pesticide')
 * @param {Array}  params.harvestActivities   — FarmActivity records (activityType = 'harvesting')
 * @param {boolean} params.hasOfficerValidation — whether any officer validation exists
 * @param {object} [params.rules]             — override default rule thresholds
 * @returns {object} Full compliance result with context, timeline, confidence
 */
export function evaluatePesticideCompliance(params = {}) {
  // Support legacy call signature: evaluatePesticideCompliance(arrayOfActivities)
  if (Array.isArray(params)) {
    return evaluatePesticideCompliance({ pesticideActivities: params });
  }

  // Guard null/undefined — treat as empty input
  if (!params || typeof params !== 'object') {
    params = {};
  }

  const {
    pesticideActivities = [],
    harvestActivities = [],
    hasOfficerValidation = false,
    rules = {},
  } = params;

  const cfg = { ...DEFAULT_RULES, ...rules };
  const confidence = determineConfidence(hasOfficerValidation);

  // ── No pesticide records → needs_review ──
  if (!pesticideActivities || pesticideActivities.length === 0) {
    const wording = FARMER_WORDING.needs_review;
    return {
      status: 'needs_review',
      reason: 'No pesticide usage records found.',
      action: wording.action,
      farmerLabel: wording.label,
      confidence,
      violations: [],
      missingFields: [],
      context: {
        lastPesticideDate: null,
        lastHarvestDate: findLastDate(harvestActivities),
        lastUpdateType: harvestActivities.length > 0 ? 'harvesting' : null,
      },
      timeline: buildComplianceTimeline([], harvestActivities, cfg.harvestWaitingPeriodDays),
      rules: cfg,
      summary: emptySummary(),
    };
  }

  // Sort ascending
  const sorted = [...pesticideActivities].sort(
    (a, b) => new Date(a.activityDate) - new Date(b.activityDate)
  );

  // ── STEP 1: Completeness (highest priority — STOP) ──
  const missingFields = [];
  let completeRecords = 0;

  for (const act of sorted) {
    const missing = checkRequiredFields(act);
    if (missing) {
      missingFields.push(missing);
    } else {
      completeRecords++;
    }
  }

  const lastPesticideDate = sorted[sorted.length - 1].activityDate;
  const lastHarvestDate = findLastDate(harvestActivities);
  const lastUpdateType = determineLastUpdateType(lastPesticideDate, lastHarvestDate);

  const contextObj = { lastPesticideDate, lastHarvestDate, lastUpdateType };

  if (missingFields.length > 0) {
    const wording = FARMER_WORDING.needs_review;
    return {
      status: 'needs_review',
      reason: `${missingFields.length} record${missingFields.length > 1 ? 's' : ''} missing required data.`,
      action: wording.action,
      farmerLabel: wording.label,
      confidence,
      violations: [],
      missingFields,
      context: contextObj,
      timeline: buildComplianceTimeline(pesticideActivities, harvestActivities, cfg.harvestWaitingPeriodDays),
      rules: cfg,
      summary: buildSummary(sorted, completeRecords, missingFields.length, 0),
    };
  }

  // ── STEP 2: Rule violations (STOP if any) ──
  const violations = [];

  // Rule A: Waiting period between pesticide applications
  violations.push(...checkWaitingPeriod(sorted, cfg.minDaysBetweenApplications));

  // Rule B: Overuse / frequency cap
  const { violation: overuseViolation, recentCount } = checkOveruse(
    sorted, cfg.maxApplicationsPerWindow, cfg.frequencyWindowDays
  );
  if (overuseViolation) violations.push(overuseViolation);

  // Rule C: Harvest safety — harvest too soon after last pesticide
  const harvestViolation = checkHarvestSafety(
    lastPesticideDate, lastHarvestDate, cfg.harvestWaitingPeriodDays
  );
  if (harvestViolation) violations.push(harvestViolation);

  if (violations.length > 0) {
    const wording = FARMER_WORDING.non_compliant;
    // Build specific action from first violation
    const firstViolation = violations[0];
    let action = wording.action;
    if (firstViolation.rule === 'harvest_too_soon') {
      const daysLeft = firstViolation.requiredDays - firstViolation.daysBetween;
      action = `Wait ${daysLeft > 0 ? daysLeft : cfg.harvestWaitingPeriodDays} more day${daysLeft !== 1 ? 's' : ''} before harvesting.`;
    } else if (firstViolation.rule === 'waiting_period') {
      action = `Space pesticide applications at least ${cfg.minDaysBetweenApplications} days apart.`;
    } else if (firstViolation.rule === 'excessive_frequency') {
      action = `Reduce pesticide use — maximum ${cfg.maxApplicationsPerWindow} applications per ${cfg.frequencyWindowDays} days.`;
    }

    return {
      status: 'non_compliant',
      reason: `${violations.length} rule violation${violations.length > 1 ? 's' : ''} detected.`,
      action,
      farmerLabel: wording.label,
      confidence,
      violations,
      missingFields: [],
      context: contextObj,
      timeline: buildComplianceTimeline(pesticideActivities, harvestActivities, cfg.harvestWaitingPeriodDays),
      rules: cfg,
      summary: buildSummary(sorted, completeRecords, 0, recentCount),
    };
  }

  // ── STEP 3: Compliant ──
  const wording = FARMER_WORDING.compliant;
  return {
    status: 'compliant',
    reason: 'All pesticide usage follows safe practices.',
    action: wording.action,
    farmerLabel: wording.label,
    confidence,
    violations: [],
    missingFields: [],
    context: contextObj,
    timeline: buildComplianceTimeline(pesticideActivities, harvestActivities, cfg.harvestWaitingPeriodDays),
    rules: cfg,
    summary: buildSummary(sorted, completeRecords, 0, recentCount),
  };
}

// ─── Helpers ──────────────────────────────────────────────

function findLastDate(activities) {
  if (!activities || activities.length === 0) return null;
  const sorted = [...activities].sort((a, b) => new Date(b.activityDate) - new Date(a.activityDate));
  return sorted[0].activityDate;
}

function determineLastUpdateType(lastPesticideDate, lastHarvestDate) {
  if (!lastPesticideDate && !lastHarvestDate) return null;
  if (!lastPesticideDate) return 'harvesting';
  if (!lastHarvestDate) return 'pesticide';
  return new Date(lastHarvestDate) >= new Date(lastPesticideDate) ? 'harvesting' : 'pesticide';
}

function emptySummary() {
  return {
    totalApplications: 0,
    completeRecords: 0,
    incompleteRecords: 0,
    recentApplications: 0,
    oldestApplication: null,
    newestApplication: null,
  };
}

function buildSummary(sorted, completeRecords, incompleteRecords, recentCount) {
  return {
    totalApplications: sorted.length,
    completeRecords,
    incompleteRecords,
    recentApplications: recentCount,
    oldestApplication: sorted[0]?.activityDate ?? null,
    newestApplication: sorted[sorted.length - 1]?.activityDate ?? null,
  };
}

// ─── Org-level summary ────────────────────────────────────

/**
 * Summarize compliance across multiple farmers.
 * @param {Array<{ status }>} complianceResults
 * @returns {{ compliant, needsReview, nonCompliant, totalEvaluated }}
 */
export function summarizeCompliance(complianceResults = []) {
  let compliant = 0;
  let needsReview = 0;
  let nonCompliant = 0;

  for (const r of complianceResults) {
    if (r.status === 'compliant') compliant++;
    else if (r.status === 'needs_review') needsReview++;
    else if (r.status === 'non_compliant') nonCompliant++;
  }

  return { compliant, needsReview, nonCompliant, totalEvaluated: complianceResults.length };
}
