/**
 * exportService.js — RFC 4180 CSV export helpers for the org
 * dashboard. Matches the style already used by ngoAdmin/
 * farmEventsService.js (manual quoting, no external dep).
 *
 *   buildFarmersCsv(farmers, { org? })
 *     → Uint8Array | string UTF-8 CSV ready to stream.
 *
 *   buildDashboardCsv(dashboard)
 *     → Uint8Array | string — a compact report summarising the
 *       org dashboard metrics.
 */

/**
 * escapeCsvField(value)
 *   RFC 4180: wrap in quotes if the value contains a comma, quote,
 *   CR, or LF. Escape embedded quotes by doubling. Null / undefined
 *   become empty strings.
 */
export function escapeCsvField(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[,"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells) {
  return cells.map(escapeCsvField).join(',');
}

/**
 * buildFarmersCsv(farmers, { org? })
 *   `farmers` is the enriched list from listOrganizationFarmers
 *   (id, fullName, region, primaryCrop, score, etc.). Unknown
 *   fields are tolerated — missing ones become empty cells.
 */
export function buildFarmersCsv(farmers = [], { org = null } = {}) {
  const header = [
    'farmer_id', 'full_name', 'phone', 'region', 'registration_status',
    'primary_crop', 'farroway_score', 'score_band', 'score_date',
    'trust_level', 'trust_score', 'trust_checks_passed',
    'created_at', 'updated_at',
    ...(org ? ['organization_id', 'organization_name'] : []),
  ];
  const lines = [row(header)];
  for (const f of farmers) {
    const base = [
      f.id, f.fullName, f.phoneNumber, f.region, f.registrationStatus,
      f.primaryCrop, f.score ? f.score.overall : '',
      f.score ? f.score.band : '', f.score ? f.score.date : '',
      f.trust ? f.trust.level : '',
      f.trust ? f.trust.score : '',
      f.trust ? `${f.trust.passedCount}/${f.trust.totalCount}` : '',
      iso(f.createdAt), iso(f.updatedAt),
    ];
    if (org) {
      base.push(org.id || '', org.name || '');
    }
    lines.push(row(base));
  }
  // Trailing newline per RFC 4180.
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * buildDashboardCsv(dashboard)
 *   Compact tabular dump. First block: summary metrics. Next:
 *   crop distribution. Next: yield-by-crop.
 */
export function buildDashboardCsv(dashboard) {
  if (!dashboard) return '';
  const lines = [];
  lines.push(row(['metric', 'value']));
  lines.push(row(['organization_id',       dashboard.organizationId]));
  lines.push(row(['total_farmers',          dashboard.totalFarmers]));
  lines.push(row(['active_farmers',         dashboard.active]));
  lines.push(row(['inactive_farmers',       dashboard.inactive]));
  lines.push(row(['average_score',
                   dashboard.averageScore && dashboard.averageScore.value != null
                     ? dashboard.averageScore.value : '']));
  lines.push(row(['average_score_band',
                   dashboard.averageScore ? dashboard.averageScore.band || '' : '']));
  lines.push(row(['score_sample_size',
                   dashboard.averageScore ? dashboard.averageScore.sampleSize : 0]));
  lines.push(row(['risk_farmers_with_alerts',
                   dashboard.riskIndicators ? dashboard.riskIndicators.farmersWithPendingAlerts : 0]));
  lines.push(row(['market_alerts',
                   dashboard.riskIndicators ? dashboard.riskIndicators.marketAlerts : 0]));
  lines.push(row(['weather_alerts',
                   dashboard.riskIndicators ? dashboard.riskIndicators.weatherAlerts : 0]));
  lines.push(row(['pest_alerts',
                   dashboard.riskIndicators ? dashboard.riskIndicators.pestAlerts : 0]));
  lines.push(row(['total_projected_kg',
                   dashboard.yieldProjection ? dashboard.yieldProjection.totalKg : 0]));
  lines.push(row(['trust_high',   dashboard.trust ? dashboard.trust.high   : 0]));
  lines.push(row(['trust_medium', dashboard.trust ? dashboard.trust.medium : 0]));
  lines.push(row(['trust_low',    dashboard.trust ? dashboard.trust.low    : 0]));
  lines.push(row(['trust_average',dashboard.trust ? dashboard.trust.average: 0]));
  lines.push(row(['window_days',
                   dashboard.window ? dashboard.window.days : 30]));
  lines.push(row(['generated_at', dashboard.generatedAt]));
  lines.push('');

  // Crop distribution
  lines.push(row(['section', 'crop_distribution']));
  lines.push(row(['crop', 'farms', 'share']));
  if (dashboard.cropDistribution) {
    for (const r of dashboard.cropDistribution) {
      lines.push(row([r.crop, r.farms, r.share.toFixed(3)]));
    }
  }
  lines.push('');

  // Yield by crop
  lines.push(row(['section', 'yield_by_crop']));
  lines.push(row(['crop', 'farms', 'projected_kg']));
  if (dashboard.yieldProjection && dashboard.yieldProjection.byCrop) {
    for (const r of dashboard.yieldProjection.byCrop) {
      lines.push(row([r.crop, r.farms, r.kg]));
    }
  }

  return `${lines.join('\r\n')}\r\n`;
}

function iso(d) {
  if (!d) return '';
  try { return new Date(d).toISOString(); } catch { return ''; }
}

/**
 * buildPilotMetricsCsv(metrics)
 *   Single spreadsheet with sections: adoption, engagement,
 *   performance, outcomes, weekly trends, monthly trends, top
 *   regions, at-risk farmers.
 */
export function buildPilotMetricsCsv(metrics) {
  if (!metrics) return '';
  const lines = [];

  // Summary metric/value pairs
  lines.push(row(['metric', 'value']));
  lines.push(row(['organization_id',    metrics.organizationId]));
  lines.push(row(['window_days',        metrics.window && metrics.window.days]));
  lines.push(row(['generated_at',       metrics.generatedAt]));
  lines.push('');

  // Adoption
  lines.push(row(['section', 'adoption']));
  lines.push(row(['total_farmers',      metrics.adoption.total]));
  lines.push(row(['active_weekly',      metrics.adoption.activeWeekly]));
  lines.push(row(['active_monthly',     metrics.adoption.activeMonthly]));
  lines.push(row(['new_this_period',    metrics.adoption.newThisPeriod]));
  lines.push(row(['adoption_rate',      metrics.adoption.adoptionRate]));
  lines.push('');

  // Engagement
  lines.push(row(['section', 'engagement']));
  lines.push(row(['tasks_completed',              metrics.engagement.tasksCompleted]));
  lines.push(row(['tasks_completed_per_week',     metrics.engagement.tasksCompletedPerWeek]));
  lines.push(row(['task_completion_rate',
                   metrics.engagement.taskCompletionRate == null
                     ? '' : metrics.engagement.taskCompletionRate]));
  lines.push(row(['on_time',                      metrics.engagement.onTime]));
  lines.push(row(['late',                         metrics.engagement.late]));
  lines.push(row(['notification_engagement',
                   metrics.engagement.notificationEngagement == null
                     ? '' : metrics.engagement.notificationEngagement]));
  lines.push(row(['completion_source',            metrics.engagement.source || '']));
  lines.push('');

  // Performance
  lines.push(row(['section', 'performance']));
  lines.push(row(['average_score',
                   metrics.performance.averageScore == null
                     ? '' : metrics.performance.averageScore]));
  lines.push(row(['score_band',  metrics.performance.scoreBand || '']));
  const dist = metrics.performance.scoreDistribution || {};
  for (const band of ['excellent', 'strong', 'improving', 'needs_help']) {
    lines.push(row([`score_distribution_${band}`, dist[band] || 0]));
  }
  const td = metrics.performance.trustDistribution || {};
  lines.push(row(['trust_high',    td.high    || 0]));
  lines.push(row(['trust_medium',  td.medium  || 0]));
  lines.push(row(['trust_low',     td.low     || 0]));
  lines.push(row(['trust_average', td.average || 0]));
  lines.push('');

  // Outcomes
  lines.push(row(['section', 'outcomes']));
  lines.push(row(['estimated_yield_kg',      metrics.outcomes.estimatedYieldKg]));
  lines.push(row(['marketplace_listings',    metrics.outcomes.marketplaceListings]));
  lines.push(row(['marketplace_requests',    metrics.outcomes.marketplaceRequests]));
  lines.push(row(['accepted_requests',       metrics.outcomes.acceptedRequests]));
  lines.push('');

  // Weekly trends
  lines.push(row(['section', 'trends_weekly']));
  lines.push(row(['week_start', 'active', 'tasks', 'listings', 'requests', 'avg_score']));
  for (const b of (metrics.trends && metrics.trends.weekly) || []) {
    lines.push(row([b.weekStart, b.active, b.tasks, b.listings, b.requests,
                      b.avgScore == null ? '' : b.avgScore]));
  }
  lines.push('');

  // Monthly trends
  lines.push(row(['section', 'trends_monthly']));
  lines.push(row(['month_start', 'active', 'tasks', 'listings', 'requests', 'avg_score']));
  for (const b of (metrics.trends && metrics.trends.monthly) || []) {
    lines.push(row([b.monthStart, b.active, b.tasks, b.listings, b.requests,
                      b.avgScore == null ? '' : b.avgScore]));
  }
  lines.push('');

  // Top regions
  lines.push(row(['section', 'top_regions']));
  lines.push(row(['region', 'farmers', 'average_score',
                   'task_completion_rate', 'task_completion_rate_source']));
  for (const r of metrics.topRegions || []) {
    lines.push(row([r.region, r.farmers,
                     r.averageScore == null ? '' : r.averageScore,
                     r.taskCompletionRate == null ? '' : r.taskCompletionRate,
                     r.taskCompletionRateSource || '']));
  }
  lines.push('');

  // At-risk farmers
  lines.push(row(['section', 'at_risk_farmers']));
  lines.push(row(['farmer_id', 'full_name', 'region', 'score', 'reasons']));
  for (const f of metrics.atRiskFarmers || []) {
    const reasonList = (f.reasons || []).map((r) => r.code).join(';');
    lines.push(row([f.farmerId, f.fullName,
                     f.region || '',
                     f.score == null ? '' : f.score,
                     reasonList]));
  }
  lines.push('');

  // Period-over-period deltas. Each row is (metric, current,
  // previous, absolute, relative) so spreadsheet users can chart
  // absolute change, percent change, or both.
  const pop = metrics.periodOverPeriod;
  if (pop) {
    lines.push(row(['section', 'period_over_period']));
    lines.push(row(['previous_window_from',
                     (pop.previousWindow && pop.previousWindow.from) || '']));
    lines.push(row(['previous_window_to',
                     (pop.previousWindow && pop.previousWindow.to) || '']));
    lines.push(row(['metric', 'current', 'previous', 'absolute', 'relative']));
    const popRow = (name, d) => {
      if (!d) return;
      lines.push(row([name,
        d.current  == null ? '' : d.current,
        d.previous == null ? '' : d.previous,
        d.absolute == null ? '' : d.absolute,
        d.relative == null ? '' : d.relative,
      ]));
    };
    if (pop.adoption) {
      popRow('adoption_active_monthly', pop.adoption.activeMonthly);
      popRow('adoption_rate',           pop.adoption.adoptionRate);
      popRow('adoption_new_this_period',pop.adoption.newThisPeriod);
    }
    if (pop.engagement) {
      popRow('engagement_tasks_completed',         pop.engagement.tasksCompleted);
      popRow('engagement_tasks_completed_per_week',pop.engagement.tasksCompletedPerWeek);
      popRow('engagement_task_completion_rate',    pop.engagement.taskCompletionRate);
    }
    if (pop.outcomes) {
      popRow('outcomes_estimated_yield_kg',    pop.outcomes.estimatedYieldKg);
      popRow('outcomes_marketplace_listings',  pop.outcomes.marketplaceListings);
      popRow('outcomes_marketplace_requests',  pop.outcomes.marketplaceRequests);
      popRow('outcomes_accepted_requests',     pop.outcomes.acceptedRequests);
    }
  }

  return `${lines.join('\r\n')}\r\n`;
}
