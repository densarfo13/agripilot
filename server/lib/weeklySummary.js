/**
 * Weekly Summary Engine — generates a farm-specific decision digest.
 *
 * Combines existing farm intelligence signals into a simple, useful
 * weekly operating summary. No new data sources — consumes what
 * the task engine, risk engine, weather, input timing, harvest,
 * economics, and benchmarking systems already produce.
 *
 * Pure computation — caller provides all inputs. No DB calls.
 *
 * Sections:
 *   1. headline        — one-sentence farm focus for the week
 *   2. priorities      — top 3–5 actions ranked by urgency
 *   3. risks           — active risk alerts
 *   4. inputNotes      — fertilizer/input timing guidance
 *   5. harvestNotes    — harvest/post-harvest guidance
 *   6. economicsNote   — profit/performance snapshot
 *   7. nextSteps       — "what to do next" list
 *   8. missingData     — honest notes about gaps
 */

// ─── Types (JSDoc) ────────────────────────────────────────

/**
 * @typedef {Object} WeeklySummaryInput
 * @property {string} farmId
 * @property {string} crop
 * @property {string} stage
 * @property {string} farmerType - 'new' | 'experienced'
 * @property {import('./seasonalTiming.js').SeasonalContext} [seasonal]
 * @property {import('./farmTaskEngine.js').WeatherContext} [weather]
 * @property {import('./pestRiskEngine.js').FarmRisk[]} [risks]
 * @property {import('./inputTimingEngine.js').FarmInputRecommendation[]} [inputRecs]
 * @property {import('./harvestEngine.js').FarmHarvestRecommendation[]} [harvestRecs]
 * @property {import('./farmTaskEngine.js').FarmTask[]} [tasks]
 * @property {boolean} [hasRecentHarvestRecord]
 * @property {boolean} [hasCostRecords]
 * @property {boolean} [hasRevenueData]
 * @property {import('./farmBenchmarking.js').BenchmarkInsights} [benchmarkInsights]
 * @property {import('./farmBenchmarking.js').FarmBenchmarkSummary} [benchmark]
 * @property {{ totalRevenue: number, totalCosts: number, estimatedProfit: number, revenueIsPartial: boolean }} [economics]
 * @property {{ totalHarvested: number, totalSold: number, dominantUnit: string }} [harvestSummary]
 */

/**
 * @typedef {Object} WeeklyPriorityItem
 * @property {string} text
 * @property {'high'|'medium'|'low'} priority
 * @property {string} [source] - which subsystem generated this
 */

/**
 * @typedef {Object} WeeklyRiskItem
 * @property {string} text
 * @property {'high'|'medium'|'low'} severity
 * @property {string} type - 'pest' | 'disease' | 'weather' | 'performance'
 */

/**
 * @typedef {Object} WeeklyDecisionDigest
 * @property {string} farmId
 * @property {string} headline
 * @property {WeeklyPriorityItem[]} priorities
 * @property {WeeklyRiskItem[]} risks
 * @property {string[]} inputNotes
 * @property {string[]} harvestNotes
 * @property {string|null} economicsNote
 * @property {string[]} nextSteps
 * @property {string[]} missingData
 * @property {string} generatedAt
 */

// ═══════════════════════════════════════════════════════════
//  HEADLINE GENERATION
// ═══════════════════════════════════════════════════════════

/**
 * Build a one-sentence headline based on the dominant signal.
 * @param {WeeklySummaryInput} input
 * @param {WeeklyRiskItem[]} risks
 * @returns {string}
 */
function buildHeadline(input, risks) {
  const { stage, weather, benchmarkInsights } = input;
  const highRisks = risks.filter(r => r.severity === 'high');

  // High-risk situations dominate
  if (highRisks.length > 0) {
    const hasWeatherRisk = highRisks.some(r => r.type === 'weather');
    const hasPestRisk = highRisks.some(r => r.type === 'pest' || r.type === 'disease');
    if (hasWeatherRisk && hasPestRisk) {
      return 'Weather and pest risks need attention this week.';
    }
    if (hasPestRisk) {
      return 'Disease prevention and inspection should be prioritized this week.';
    }
    if (hasWeatherRisk) {
      if (weather && weather.drySpellRisk) {
        return 'Moisture management is the main focus this week.';
      }
      if (weather && weather.heavyRainRisk) {
        return 'Heavy rain expected — protect your crop and delay field work if needed.';
      }
      return 'Weather conditions need close monitoring this week.';
    }
    return 'There are risks that need your attention this week.';
  }

  // Weather-driven headlines
  if (weather && weather.hasWeatherData) {
    if (weather.drySpellRisk) {
      return 'Moisture management is the main focus this week.';
    }
    if (weather.heavyRainRisk) {
      return 'Heavy rain expected — protect your crop and delay field work if needed.';
    }
    if (weather.humidityPct != null && weather.humidityPct > 80) {
      return 'High humidity — watch for disease and keep inspecting your crop.';
    }
  }

  // Stage-driven headlines
  if (stage === 'harvest' || stage === 'post_harvest') {
    if (!input.hasRecentHarvestRecord) {
      return 'Harvest readiness and recordkeeping are the main focus now.';
    }
    return 'Post-harvest handling and storage are the priority this week.';
  }
  if (stage === 'flowering' || stage === 'fruiting') {
    return 'Your crop is at a critical growth stage — stay on top of care and monitoring.';
  }
  if (stage === 'vegetative') {
    return 'Focus on crop nutrition, weeding, and pest monitoring this week.';
  }
  if (stage === 'planting' || stage === 'germination') {
    return 'Early establishment care is important — check moisture and seedling health.';
  }
  if (stage === 'land_preparation') {
    return 'Prepare your land well — this sets the foundation for the season.';
  }

  // Benchmark-driven fallback
  if (benchmarkInsights) {
    if (benchmarkInsights.profitDropped) {
      return 'Review rising farm costs and input efficiency.';
    }
    if (benchmarkInsights.yieldDropped) {
      return 'Your yield trend needs attention — review what changed.';
    }
  }

  // Planning / generic
  if (stage === 'planning') {
    return 'Plan ahead — set your crop stage and seasonal timing for better recommendations.';
  }

  return 'Your farm summary for this week is ready.';
}

// ═══════════════════════════════════════════════════════════
//  RISK EXTRACTION
// ═══════════════════════════════════════════════════════════

/**
 * Extract risk alerts from all subsystems.
 * @param {WeeklySummaryInput} input
 * @returns {WeeklyRiskItem[]}
 */
function extractRisks(input) {
  const { weather, risks, benchmarkInsights } = input;
  /** @type {WeeklyRiskItem[]} */
  const items = [];

  // Weather risks
  if (weather && weather.hasWeatherData) {
    if (weather.drySpellRisk) {
      items.push({
        text: 'Dry spell risk — prioritize irrigation and moisture conservation.',
        severity: 'high',
        type: 'weather',
      });
    }
    if (weather.heavyRainRisk) {
      items.push({
        text: 'Heavy rain risk — delay fertilizer and protect vulnerable crops.',
        severity: 'high',
        type: 'weather',
      });
    }
    if (weather.humidityPct != null && weather.humidityPct > 80) {
      items.push({
        text: 'High humidity increases fungal and disease risk.',
        severity: 'medium',
        type: 'weather',
      });
    }
  }

  // Pest/disease risks
  if (risks && risks.length > 0) {
    for (const risk of risks) {
      if (risk.severity === 'high' || risk.severity === 'medium') {
        items.push({
          text: `${risk.type === 'pest' ? 'Pest' : 'Disease'}: ${risk.title} — ${risk.action}`,
          severity: risk.severity,
          type: risk.type === 'pest' ? 'pest' : 'disease',
        });
      }
    }
  }

  // Performance risks from benchmarking
  if (benchmarkInsights) {
    if (benchmarkInsights.profitDropped) {
      items.push({
        text: 'Profit declined compared to last period — review costs and prices.',
        severity: 'medium',
        type: 'performance',
      });
    }
    if (benchmarkInsights.yieldDropped) {
      items.push({
        text: 'Yield dropped compared to last period — check for causes.',
        severity: 'medium',
        type: 'performance',
      });
    }
    if (benchmarkInsights.costsIncreased) {
      items.push({
        text: 'Farm costs increased significantly — review spending.',
        severity: 'low',
        type: 'performance',
      });
    }
  }

  // Sort: high first, then medium, then low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return items;
}

// ═══════════════════════════════════════════════════════════
//  PRIORITY EXTRACTION
// ═══════════════════════════════════════════════════════════

/**
 * Extract top priorities from tasks, capped at 5.
 * @param {WeeklySummaryInput} input
 * @returns {WeeklyPriorityItem[]}
 */
function extractPriorities(input) {
  const { tasks } = input;
  /** @type {WeeklyPriorityItem[]} */
  const items = [];

  if (tasks && tasks.length > 0) {
    // Sort tasks: high > medium > low
    const sorted = [...tasks].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    });

    for (const task of sorted.slice(0, 5)) {
      let source = 'task';
      if (task.riskNote) source = 'risk';
      else if (task.inputNote) source = 'input';
      else if (task.harvestNote) source = 'harvest';
      else if (task.economicsNote) source = 'economics';
      else if (task.benchmarkNote) source = 'benchmark';
      else if (task.weatherNote) source = 'weather';
      else if (task.seasonalNote) source = 'seasonal';

      items.push({
        text: task.title,
        priority: task.priority,
        source,
      });
    }
  }

  return items;
}

// ═══════════════════════════════════════════════════════════
//  INPUT NOTES
// ═══════════════════════════════════════════════════════════

/**
 * Build input/fertilizer timing notes.
 * @param {WeeklySummaryInput} input
 * @returns {string[]}
 */
function buildInputNotes(input) {
  const { inputRecs } = input;
  const notes = [];

  if (!inputRecs || inputRecs.length === 0) return notes;

  for (const rec of inputRecs) {
    if (rec.priority === 'high') {
      let note = rec.title;
      if (rec.isDelayed) {
        note += ' (delayed due to weather)';
      }
      notes.push(note);
    }
  }

  if (notes.length === 0 && inputRecs.length > 0) {
    notes.push('No urgent input actions this week. Continue following your timing plan.');
  }

  return notes;
}

// ═══════════════════════════════════════════════════════════
//  HARVEST NOTES
// ═══════════════════════════════════════════════════════════

/**
 * Build harvest/post-harvest notes.
 * @param {WeeklySummaryInput} input
 * @returns {string[]}
 */
function buildHarvestNotes(input) {
  const { stage, harvestRecs, hasRecentHarvestRecord, harvestSummary } = input;
  const notes = [];

  const isHarvestStage = stage === 'harvest' || stage === 'post_harvest';

  if (isHarvestStage && !hasRecentHarvestRecord) {
    notes.push('You are in harvest stage but have not logged a yield record yet.');
  }

  if (harvestRecs && harvestRecs.length > 0) {
    const highRecs = harvestRecs.filter(r => r.priority === 'high');
    for (const rec of highRecs) {
      notes.push(rec.title);
    }
  }

  if (hasRecentHarvestRecord && harvestSummary) {
    const unit = harvestSummary.dominantUnit || 'units';
    notes.push(`Recent harvest: ${harvestSummary.totalHarvested} ${unit} harvested.`);
    if (harvestSummary.totalSold > 0) {
      notes.push(`${harvestSummary.totalSold} ${unit} sold so far.`);
    }
  }

  return notes;
}

// ═══════════════════════════════════════════════════════════
//  ECONOMICS NOTE
// ═══════════════════════════════════════════════════════════

/**
 * Build a single economics/performance note.
 * @param {WeeklySummaryInput} input
 * @returns {string|null}
 */
function buildEconomicsNote(input) {
  const { economics, benchmarkInsights, hasCostRecords, hasRevenueData } = input;

  if (economics) {
    const { totalRevenue, totalCosts, estimatedProfit, revenueIsPartial } = economics;
    const parts = [];
    if (totalRevenue > 0) {
      parts.push(`Revenue: ${totalRevenue.toLocaleString()}`);
    }
    if (totalCosts > 0) {
      parts.push(`Costs: ${totalCosts.toLocaleString()}`);
    }
    if (estimatedProfit != null) {
      const sign = estimatedProfit >= 0 ? '+' : '';
      parts.push(`Profit: ${sign}${estimatedProfit.toLocaleString()}`);
    }
    if (revenueIsPartial) {
      parts.push('(revenue estimate is partial — add selling prices for accuracy)');
    }
    if (parts.length > 0) return parts.join(' · ');
  }

  if (benchmarkInsights && benchmarkInsights.profitDropped) {
    return 'Profit declined compared to the previous period. Review costs and selling prices.';
  }

  if (!hasCostRecords && !hasRevenueData) {
    return null; // handled by missingData
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
//  NEXT STEPS
// ═══════════════════════════════════════════════════════════

/**
 * Build "what to do next" action items.
 * @param {WeeklySummaryInput} input
 * @param {WeeklyPriorityItem[]} priorities
 * @param {WeeklyRiskItem[]} risks
 * @returns {string[]}
 */
function buildNextSteps(input, priorities, risks) {
  const { stage, hasRecentHarvestRecord, hasCostRecords, hasRevenueData } = input;
  const steps = [];

  // From high-priority tasks
  const highPriorities = priorities.filter(p => p.priority === 'high');
  for (const p of highPriorities.slice(0, 2)) {
    steps.push(p.text);
  }

  // From high risks
  const highRisks = risks.filter(r => r.severity === 'high');
  if (highRisks.length > 0 && steps.length < 3) {
    steps.push('Address active risk alerts shown above.');
  }

  // Stage-specific
  if ((stage === 'harvest' || stage === 'post_harvest') && !hasRecentHarvestRecord && steps.length < 4) {
    steps.push('Log your harvest yield to track performance.');
  }

  if (!hasCostRecords && steps.length < 4) {
    steps.push('Start logging farm expenses to track profitability.');
  }

  if (hasRecentHarvestRecord && !hasRevenueData && steps.length < 4) {
    steps.push('Add selling prices to your harvest records for revenue tracking.');
  }

  // Generic if nothing specific
  if (steps.length === 0) {
    steps.push('Review your tasks and check on your crop this week.');
  }

  return steps.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════
//  MISSING DATA NOTES
// ═══════════════════════════════════════════════════════════

/**
 * Build honest missing-data notes.
 * @param {WeeklySummaryInput} input
 * @returns {string[]}
 */
function buildMissingDataNotes(input) {
  const { stage, seasonal, weather, hasCostRecords, hasRevenueData, benchmarkInsights } = input;
  const notes = [];

  if (!stage || stage === 'planning') {
    notes.push('Set crop stage to improve task accuracy.');
  }

  if (!seasonal || !seasonal.hasSeasonalData) {
    notes.push('Add seasonal timing to improve timing recommendations.');
  }

  if (!weather || !weather.hasWeatherData) {
    notes.push('Weather context is limited right now.');
  }

  if (!hasCostRecords) {
    notes.push('Log farm expenses to see profitability.');
  }

  if (!hasRevenueData && input.hasRecentHarvestRecord) {
    notes.push('Add selling prices to harvest records for revenue estimates.');
  }

  if (benchmarkInsights && benchmarkInsights.noComparisonData) {
    notes.push('Keep logging harvest and costs to unlock stronger benchmarking.');
  }

  return notes;
}

// ═══════════════════════════════════════════════════════════
//  MAIN ENTRY — generateWeeklySummary
// ═══════════════════════════════════════════════════════════

/**
 * Generate a weekly decision digest for a farm.
 *
 * @param {WeeklySummaryInput} input
 * @returns {WeeklyDecisionDigest}
 */
export function generateWeeklySummary(input) {
  const risks = extractRisks(input);
  const priorities = extractPriorities(input);
  const inputNotes = buildInputNotes(input);
  const harvestNotes = buildHarvestNotes(input);
  const economicsNote = buildEconomicsNote(input);
  const nextSteps = buildNextSteps(input, priorities, risks);
  const missingData = buildMissingDataNotes(input);
  const headline = buildHeadline(input, risks);

  return {
    farmId: input.farmId,
    headline,
    priorities,
    risks,
    inputNotes,
    harvestNotes,
    economicsNote,
    nextSteps,
    missingData,
    generatedAt: new Date().toISOString(),
  };
}

export default { generateWeeklySummary };
