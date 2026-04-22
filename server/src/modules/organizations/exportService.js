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
    'created_at', 'updated_at',
    ...(org ? ['organization_id', 'organization_name'] : []),
  ];
  const lines = [row(header)];
  for (const f of farmers) {
    const base = [
      f.id, f.fullName, f.phoneNumber, f.region, f.registrationStatus,
      f.primaryCrop, f.score ? f.score.overall : '',
      f.score ? f.score.band : '', f.score ? f.score.date : '',
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
