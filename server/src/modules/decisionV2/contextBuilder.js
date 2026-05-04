/**
 * decisionV2/contextBuilder.js — assembles the rich context
 * the v2 decision engine needs from the various data sources.
 *
 *   const ctx = await buildDecisionContext({ prisma, userId, query });
 *
 * Returns a normalized envelope that downstream rules consume:
 *
 *   {
 *     userType, cropOrPlant, growthStage,
 *     locationCountry, locationRegion, lat, lng,
 *     weather: { condition, temperature, humidity, rainfallMm, summary },
 *     soil:    { moistureLevel, soilType, riskLevel, source } | null,
 *     satellite:{ stressLevel, vegetationIndex, droughtSignal } | null,
 *     region:  { pestRisk, diseaseRisk, droughtRisk, recommendation } | null,
 *     scan:    { lastStatus, lastIssueType, lastScannedAt } | null,
 *     lastActions: { lastWateredAt, lastInspectedAt, lastTaskId } | null,
 *     language,
 *   }
 *
 * Each source is fetched in parallel; ANY failure leaves that
 * branch as `null` so the rule layer can degrade gracefully.
 * Spec §15: "If soil unavailable: continue. If satellite
 * unavailable: continue. If region intelligence unavailable:
 * continue. No blank screen."
 *
 * Strict-rule audit
 *   • Pure async aggregator — never throws.
 *   • Read-only; never writes to the DB.
 *   • Caller passes `prisma` so tests can inject a stub.
 *   • Each fetch is wrapped in its own try/catch so one bad
 *     source never breaks the whole context.
 */

import { getLatestSoilSnapshot } from '../soil/service.js';
import { getLatestSatelliteSnapshot } from '../satellite/service.js';
import { getRegionInsight } from '../region/service.js';

/**
 * buildDecisionContext({ prisma, userId, query })
 *
 * `query` is the typed payload from `decisionQuerySchema` —
 * userType, language, override fields. Profile-derived fields
 * (crop, stage, country) are looked up from the user's farm
 * profile when not in query.
 */
export async function buildDecisionContext({
  prisma, userId, query = {},
}) {
  const baseUserType = query.userType === 'backyard' ? 'backyard' : 'farmer';
  const language = query.language || 'en';

  // 1. Profile-derived defaults — single Prisma read.
  let profile = null;
  if (userId) {
    try {
      profile = await prisma.farmProfile.findFirst({
        where:   { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, crop: true, stage: true, country: true,
          locationName: true, latitude: true, longitude: true,
        },
      });
    } catch { profile = null; }
  }

  const farmId = profile && profile.id ? profile.id : null;
  const cropOrPlant = query.crop || (profile && profile.crop) || null;
  const growthStage = query.stage || (profile && profile.stage) || null;
  const locationCountry = query.country || (profile && profile.country) || null;
  const locationRegion = query.region || (profile && profile.locationName) || null;
  const lat = (typeof query.lat === 'number') ? query.lat
    : (profile && profile.latitude) || null;
  const lng = (typeof query.lng === 'number') ? query.lng
    : (profile && profile.longitude) || null;

  // 2. Run the rest of the data sources in parallel. EVERY one
  //    is wrapped in its own try/catch so a single failure can
  //    never bubble up.
  const [soil, satellite, region, scan, lastActions] = await Promise.all([
    _safe(() => getLatestSoilSnapshot(prisma, { userId, farmId })),
    _safe(() => getLatestSatelliteSnapshot(prisma, { userId, farmId, lat, lng })),
    _safe(() => getRegionInsight(prisma, { region: locationRegion, country: locationCountry, cropOrPlant })),
    _safe(() => _readScanHistory(prisma, userId)),
    _safe(() => _readLastActions(prisma, userId)),
  ]);

  // 3. Weather — passed directly via query (the route layer
  //    pre-fetches via the existing weatherProvider). When
  //    absent, the rule layer falls through to non-weather
  //    rules.
  const weather = query.weather ? {
    condition: query.weather.condition || null,
    temperature: typeof query.weather.temperature === 'number'
      ? query.weather.temperature : null,
    humidity: typeof query.weather.humidity === 'number'
      ? query.weather.humidity : null,
    rainfallMm: typeof query.weather.rainfallMm === 'number'
      ? query.weather.rainfallMm : null,
    summary: query.weather.summary || null,
  } : null;

  return {
    userType:    baseUserType,
    cropOrPlant, growthStage,
    locationCountry, locationRegion, lat, lng,
    weather, soil, satellite, region, scan, lastActions,
    language,
    farmId,
  };
}

async function _safe(thunk) {
  try {
    const r = await thunk();
    return r || null;
  } catch { return null; }
}

// ─── Scan history helper ─────────────────────────────────
//
// Reads the most-recent `scan_completed` event from
// client_events to surface lastStatus + lastIssueType. The v2
// decision engine prioritises a scan-detected issue ABOVE
// every other signal (spec §5 item 1).
async function _readScanHistory(prisma, userId) {
  if (!userId) return null;
  try {
    const row = await prisma.clientEvent.findFirst({
      where: {
        OR: [
          { type: 'scan_completed' },
          { type: 'scan_followup_task_created' },
        ],
        farmerId: userId,
        // Only look back 7 days — older scans are stale signal.
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      select: { type: true, payload: true, createdAt: true },
    });
    if (!row) return null;
    const p = row.payload || {};
    return {
      lastStatus:    p.status || null,
      lastIssueType: p.issueType || null,
      lastScannedAt: row.createdAt,
    };
  } catch { return null; }
}

// ─── Last-action helper ──────────────────────────────────
//
// Reads the most-recent task_completed event so the rule layer
// can de-dupe ("user watered within 12h → don't suggest watering
// again"). Spec §6 example: "If user watered within 12 hours →
// Skip watering now."
async function _readLastActions(prisma, userId) {
  if (!userId) return null;
  try {
    const recent = await prisma.clientEvent.findMany({
      where: {
        type: 'task_completed',
        farmerId: userId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { payload: true, createdAt: true },
    });
    if (!recent || recent.length === 0) return null;
    let lastWateredAt = null;
    let lastInspectedAt = null;
    let lastTaskId = null;
    for (const ev of recent) {
      const p = ev.payload || {};
      const ruleId = String(p.ruleId || '').toLowerCase();
      if (!lastTaskId) lastTaskId = ruleId;
      if (!lastWateredAt && (
        ruleId.includes('water') || ruleId.includes('irrigat')
        || ruleId === 'dry_irrigation' || ruleId === 'heat_stress_warning'
      )) {
        lastWateredAt = ev.createdAt;
      }
      if (!lastInspectedAt && (
        ruleId.includes('scout') || ruleId.includes('inspect')
        || ruleId === 'fallback_check'
      )) {
        lastInspectedAt = ev.createdAt;
      }
    }
    return { lastWateredAt, lastInspectedAt, lastTaskId };
  } catch { return null; }
}

export const _internal = Object.freeze({
  _safe, _readScanHistory, _readLastActions,
});
