/**
 * followUpEngine.js — auto-create the 3 / 7 / 14-day follow-ups
 * for a scan AND aggregate their `improved | same | worse`
 * outcomes for the learning loop.
 *
 * Scan V3 §7.
 *
 *   import {
 *     buildFollowUpPlan, persistFollowUpPlan,
 *     readFollowUpHistory, followUpEngineInfo,
 *   } from './followUpEngine.js';
 *
 *   const plan = buildFollowUpPlan({ scanId, growthStage, severity });
 *   await persistFollowUpPlan(prisma, { scanId, plan });
 *
 * Storage: NO new Prisma model. Plan rides on the existing
 * ScanTrainingEvent.weatherSummary JSON column under
 * `followUps: [{ dayOffset, dueAt, status }]`. Same approach the
 * V2 outcome persister uses.
 *
 * Never throws. Pure helpers + one async upsert.
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

const FOLLOWUP_OFFSETS_DAYS = Object.freeze([3, 7, 14]);
const STATUS_VALUES = Object.freeze(['pending', 'improved', 'same', 'worse']);

function _hintFor(dayOffset, severity, growthStage) {
  // Conservative copy — never alarmist, always actionable.
  if (dayOffset === 3) {
    if (severity === 'high') {
      return 'Check the same plant in 3 days. Look for spread to neighbours.';
    }
    return 'Re-scan the same plant in 3 days for a second reading.';
  }
  if (dayOffset === 7) {
    if (growthStage === 'flowering' || growthStage === 'fruiting') {
      return 'Re-scan in 7 days to track fruit / flower development.';
    }
    return 'Re-scan in 7 days to see if the treatment is working.';
  }
  if (dayOffset === 14) {
    return 'Re-scan in 14 days for an outcome confirmation.';
  }
  return 'Re-scan again.';
}

/**
 * Pure plan builder. Returns 3 follow-up rows.
 *
 *   { scanId, dayOffset, dueAt, status, hint }
 */
export function buildFollowUpPlan(input = {}) {
  const scanId   = _str(input.scanId);
  const severity = _str(input.severity);
  const growthStage = _str(input.growthStage);
  const baseMs   = _num(input.nowMs) ?? Date.now();

  const plan = FOLLOWUP_OFFSETS_DAYS.map((d) => Object.freeze({
    scanId,
    dayOffset: d,
    dueAt:     new Date(baseMs + d * 24 * 3600 * 1000).toISOString(),
    status:    'pending',
    hint:      _hintFor(d, severity, growthStage),
  }));

  return Object.freeze({
    v: 3,
    scanId,
    createdAt: new Date(baseMs).toISOString(),
    items:     Object.freeze(plan),
    limitations: 'Decision support, not a guarantee.',
  });
}

/**
 * Persist the plan onto the existing scanTrainingEvent row via the
 * weatherSummary JSON envelope. Fire-and-forget at the caller.
 * Returns { ok, reason? }.
 */
export async function persistFollowUpPlan(prisma, args = {}) {
  if (!prisma || !prisma.scanTrainingEvent) {
    return { ok: false, reason: 'prisma_missing' };
  }
  const scanId = _str(args.scanId);
  const plan = args.plan;
  if (!scanId || !plan || !Array.isArray(plan.items)) {
    return { ok: false, reason: 'invalid_input' };
  }
  try {
    const row = await prisma.scanTrainingEvent.findFirst({
      where: { scanId },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { ok: false, reason: 'scan_not_found' };
    const prev = row.weatherSummary && typeof row.weatherSummary === 'object'
      ? row.weatherSummary : {};
    await prisma.scanTrainingEvent.update({
      where: { id: row.id },
      data:  { weatherSummary: { ...prev, followUps: plan.items, followUpPlanCreatedAt: plan.createdAt } },
    });
    return { ok: true };
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[follow-up-engine] persist failed:', err && err.message);
    } catch { /* swallow */ }
    return { ok: false, reason: 'prisma_error', message: err && err.message };
  }
}

/**
 * Record the user's report on a single follow-up row (improved /
 * same / worse). Locates the row by (scanId, dayOffset).
 */
export async function recordFollowUpOutcome(prisma, args = {}) {
  if (!prisma || !prisma.scanTrainingEvent) {
    return { ok: false, reason: 'prisma_missing' };
  }
  const scanId    = _str(args.scanId);
  const dayOffset = _num(args.dayOffset);
  const status    = _str(args.status);
  if (!scanId || dayOffset == null || !STATUS_VALUES.includes(status)) {
    return { ok: false, reason: 'invalid_input' };
  }
  try {
    const row = await prisma.scanTrainingEvent.findFirst({
      where: { scanId },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { ok: false, reason: 'scan_not_found' };
    const prev = row.weatherSummary && typeof row.weatherSummary === 'object'
      ? row.weatherSummary : {};
    const items = Array.isArray(prev.followUps) ? prev.followUps.slice() : [];
    const idx = items.findIndex((i) => Number(i.dayOffset) === dayOffset);
    if (idx < 0) return { ok: false, reason: 'follow_up_not_found' };
    items[idx] = { ...items[idx], status, reportedAt: new Date().toISOString() };
    await prisma.scanTrainingEvent.update({
      where: { id: row.id },
      data: { weatherSummary: { ...prev, followUps: items } },
    });
    return { ok: true };
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[follow-up-engine] record failed:', err && err.message);
    } catch { /* swallow */ }
    return { ok: false, reason: 'prisma_error', message: err && err.message };
  }
}

/**
 * Read the user's recent follow-up history for the dashboard.
 * Returns an array of { scanId, plantName, items[]: { dayOffset,
 * dueAt, status, hint, reportedAt } }.
 */
export async function readFollowUpHistory(prisma, userId, limit = 20) {
  if (!prisma || !prisma.scanTrainingEvent || !userId) return [];
  try {
    const rows = await prisma.scanTrainingEvent.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    Math.max(1, Math.min(limit, 100)),
      select: {
        scanId: true, plantName: true,
        weatherSummary: true, createdAt: true,
      },
    });
    return rows
      .map((r) => {
        const ws = r.weatherSummary && typeof r.weatherSummary === 'object'
          ? r.weatherSummary : {};
        const items = Array.isArray(ws.followUps) ? ws.followUps : [];
        if (items.length === 0) return null;
        return {
          scanId:    r.scanId,
          plantName: r.plantName || '',
          scannedAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
          items:     items.map((i) => ({
            dayOffset:  Number(i.dayOffset) || 0,
            dueAt:      _str(i.dueAt),
            status:     STATUS_VALUES.includes(i.status) ? i.status : 'pending',
            hint:       _str(i.hint),
            reportedAt: i.reportedAt ? _str(i.reportedAt) : null,
          })),
        };
      })
      .filter(Boolean);
  } catch { return []; }
}

export function followUpEngineInfo() {
  return Object.freeze({
    name:                'follow-up-engine',
    offsetsDays:         FOLLOWUP_OFFSETS_DAYS,
    statusValues:        STATUS_VALUES,
    persistsToPrisma:    true,
    noSchemaMigration:   true,
  });
}

export const _internal = Object.freeze({
  _hintFor, FOLLOWUP_OFFSETS_DAYS, STATUS_VALUES,
});

export default buildFollowUpPlan;
