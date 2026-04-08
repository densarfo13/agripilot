/**
 * Performance Metrics Derivation
 *
 * Derives lightweight benchmark metrics from existing season data
 * (ProgressScore, ProgressEntries, OfficerValidation, HarvestReport, CredibilityAssessment).
 *
 * No data is duplicated. All values are derived from existing records.
 *
 * Per-season metrics derived:
 *   - progressScore        (from ProgressScore model, if computed)
 *   - updateCount          (count of SeasonProgressEntry)
 *   - imageCount           (count with imageUrl)
 *   - validationCount      (count of OfficerValidation)
 *   - hasHarvestReport     (bool)
 *   - yieldPerAcre         (from HarvestReport)
 *   - credibilityScore     (from CredibilityAssessment)
 *   - daysActive           (plantingDate → closedAt or now)
 *   - updateFrequency      (updates per 30 days active)
 *   - validationRate       (validations per month active)
 *   - evidenceRate         (images / max(1, updates))
 *   - completionStatus     (completed|harvested|active|abandoned|failed)
 */

/**
 * Derive benchmark metrics from a pre-fetched season with relations.
 * The season must include: progressEntries, officerValidations, harvestReport,
 * progressScore, credibilityAssessment.
 *
 * @param {Object} season - FarmSeason with relations
 * @returns {Object} flattened metrics object
 */
export function deriveSeasonMetrics(season) {
  const now = new Date();
  const plantingDate = season.plantingDate ? new Date(season.plantingDate) : now;
  const endDate = season.closedAt ? new Date(season.closedAt) : now;

  const daysActive = Math.max(1, Math.round((endDate - plantingDate) / 86400000));

  const entries = season.progressEntries || [];
  const updateCount = entries.length;
  const imageCount = entries.filter(e => e.imageUrl).length;
  const validations = season.officerValidations || [];
  const validationCount = validations.length;

  const hasHarvestReport = !!season.harvestReport;
  const yieldPerAcre = season.harvestReport?.yieldPerAcre ?? null;

  const progressScore = season.progressScore?.progressScore ?? null;
  const progressClassification = season.progressScore?.performanceClassification ?? null;
  const credibilityScore = season.credibilityAssessment?.credibilityScore ?? null;

  // Derived frequency metrics (normalised per 30 days)
  const monthsFraction = daysActive / 30;
  const updateFrequency = monthsFraction > 0
    ? Math.round((updateCount / monthsFraction) * 10) / 10
    : 0;
  const validationFrequency = monthsFraction > 0
    ? Math.round((validationCount / monthsFraction) * 10) / 10
    : 0;

  // Evidence rate: fraction of updates that include an image
  const evidenceRate = updateCount > 0
    ? Math.round((imageCount / updateCount) * 100)
    : 0;

  return {
    seasonId: season.id,
    cropType: season.cropType,
    farmSizeAcres: season.farmSizeAcres,
    plantingDate: season.plantingDate,
    expectedHarvestDate: season.expectedHarvestDate,
    closedAt: season.closedAt,
    status: season.status,
    daysActive,
    updateCount,
    imageCount,
    validationCount,
    hasHarvestReport,
    yieldPerAcre,
    progressScore,
    progressClassification,
    credibilityScore,
    updateFrequency,       // updates per 30 days
    validationFrequency,   // validations per 30 days
    evidenceRate,          // % of updates with an image
  };
}

/**
 * Aggregate metrics across an array of season metric objects.
 * Returns averages and distribution counts.
 *
 * @param {Object[]} seasonMetrics - array from deriveSeasonMetrics
 * @returns {Object} aggregate stats
 */
export function aggregateMetrics(seasonMetrics) {
  if (!seasonMetrics || seasonMetrics.length === 0) {
    return null;
  }

  const n = seasonMetrics.length;

  const avgOf = (arr, key) => {
    const valid = arr.map(m => m[key]).filter(v => v != null && !isNaN(v));
    if (valid.length === 0) return null;
    return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
  };

  const countWith = (arr, key) =>
    arr.filter(m => m[key] != null && m[key] > 0).length;

  const completedCount = seasonMetrics.filter(m =>
    m.status === 'completed' || m.status === 'harvested'
  ).length;

  const abandonedCount = seasonMetrics.filter(m =>
    m.status === 'abandoned' || m.status === 'failed'
  ).length;

  const withHarvest = seasonMetrics.filter(m => m.hasHarvestReport).length;

  return {
    seasonCount: n,
    completedCount,
    abandonedCount,
    activeCount: seasonMetrics.filter(m => m.status === 'active').length,
    withHarvestCount: withHarvest,
    completionRate: n > 0 ? Math.round((completedCount / n) * 100) : 0,
    harvestReportRate: n > 0 ? Math.round((withHarvest / n) * 100) : 0,

    avgProgressScore:       avgOf(seasonMetrics, 'progressScore'),
    avgUpdateCount:         avgOf(seasonMetrics, 'updateCount'),
    avgUpdateFrequency:     avgOf(seasonMetrics, 'updateFrequency'),
    avgValidationCount:     avgOf(seasonMetrics, 'validationCount'),
    avgValidationFrequency: avgOf(seasonMetrics, 'validationFrequency'),
    avgEvidenceRate:        avgOf(seasonMetrics, 'evidenceRate'),
    avgCredibilityScore:    avgOf(seasonMetrics, 'credibilityScore'),
    avgYieldPerAcre:        avgOf(seasonMetrics, 'yieldPerAcre'),

    seasonsWith1Validation: countWith(seasonMetrics, 'validationCount'),
    seasonsWithImages:      countWith(seasonMetrics, 'imageCount'),
    seasonsWithProgress:    countWith(seasonMetrics, 'updateCount'),
  };
}
