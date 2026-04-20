/**
 * contextService.js — THE single source of truth for every
 * farm-level derived view the frontend needs.
 *
 *   getFarmContext({ farmId, prisma, weatherFor })
 *     → {
 *         farm,
 *         risk,
 *         yield,
 *         score,
 *         funding,
 *         tasks:  [ ... machine-task shape ... ],
 *         events: {
 *           total, completed, seen, completionRate, consistencyDays,
 *         },
 *         weather,
 *         lastUpdated,
 *       }
 *
 * Composes every existing rule engine in one deterministic call
 * so the frontend can fetch ONE endpoint instead of scattering
 * local calculations + 5 parallel fetches. Prisma client and
 * weather source are injected so the same composer works in
 * tests with mock data.
 *
 * Never throws. Missing pieces degrade to safe defaults so the
 * UI always gets a complete object.
 */

import riskPkg    from '../modules/ngoAdmin/riskEngine.js';
import yieldPkg   from '../modules/ngoAdmin/yieldEngine.js';
import scorePkg   from '../modules/ngoAdmin/scoreEngine.js';
import fundingPkg from '../modules/ngoAdmin/fundingEngine.js';
const { calculateRisk }      = riskPkg;
const { estimateYield }      = yieldPkg;
const { computeScore }       = scorePkg;
const { getFundingDecision } = fundingPkg;

/**
 * deriveEventStats — pull behavior inputs from farm_events.
 */
function deriveEventStats(events = [], { nowMs = Date.now() } = {}) {
  const safe = Array.isArray(events) ? events : [];
  const days = new Set();
  const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
  let completed = 0, seen = 0;

  for (const e of safe) {
    if (!e) continue;
    if (e.eventType === 'task_completed') completed++;
    else if (e.eventType === 'task_seen') seen++;
    const ts = e.createdAt instanceof Date
      ? e.createdAt.getTime()
      : Date.parse(String(e.createdAt));
    if (Number.isFinite(ts) && ts >= thirtyDaysAgo) {
      days.add(new Date(ts).toISOString().slice(0, 10));
    }
  }
  const ratioTotal = completed + seen;
  const completionRate = ratioTotal > 0 ? completed / ratioTotal : 0.5;
  return Object.freeze({
    total:  safe.length,
    completed, seen,
    completionRate,
    consistencyDays: days.size,
  });
}

/**
 * generateBasicTasks — deterministic task list derived from
 * stage alone. Real task-engine lives client-side; this mirror
 * keeps the server context self-contained so we don't need to
 * bundle the client engine into the server runtime.
 */
function generateBasicTasks(farm = {}) {
  const stage = (farm && (farm.stage || farm.cropStage)) || 'land_prep';
  const TEMPLATES = {
    land_prep: [
      { code: 'clear_land',  titleKey: 'task.clear_land',  isPrimary: true  },
      { code: 'remove_weeds',titleKey: 'task.remove_weeds',isPrimary: false },
      { code: 'check_drainage', titleKey: 'task.check_drainage', isPrimary: false },
    ],
    planting: [
      { code: 'plant_crop',         titleKey: 'task.plant_crop',         isPrimary: true  },
      { code: 'verify_soil_ready',  titleKey: 'task.verify_soil_ready',  isPrimary: false },
    ],
    early_growth: [
      { code: 'inspect_new_growth', titleKey: 'task.inspect_new_growth', isPrimary: true  },
    ],
    maintain: [
      { code: 'check_pests', titleKey: 'task.check_pests', isPrimary: true  },
    ],
    harvest: [
      { code: 'harvest_crop', titleKey: 'task.harvest_crop', isPrimary: true  },
    ],
    post_harvest: [
      { code: 'store_crop', titleKey: 'task.store_crop', isPrimary: true  },
    ],
  };
  const list = TEMPLATES[stage] || TEMPLATES.land_prep;
  return list.map((t) => Object.freeze({
    id: `${farm.id || 'f'}:${t.code}`,
    code: t.code,
    stage,
    titleKey: t.titleKey,
    isPrimary: !!t.isPrimary,
    completed: false,
  }));
}

/**
 * loadFarm — fetch the farm by id via Prisma, with guard.
 */
async function loadFarm(prisma, farmId) {
  if (!prisma || typeof prisma.farmProfile?.findUnique !== 'function') return null;
  try {
    return await prisma.farmProfile.findUnique({ where: { id: farmId } });
  } catch { return null; }
}

async function loadEvents(prisma, farmId) {
  if (!prisma || typeof prisma.farmEvent?.findMany !== 'function') return [];
  try {
    return await prisma.farmEvent.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  } catch { return []; }
}

/**
 * getFarmContext — the single entry point.
 */
async function getFarmContext({
  farmId, prisma = null, weatherFor = null, nowMs = Date.now(),
} = {}) {
  if (!farmId || typeof farmId !== 'string') {
    return Object.freeze({
      farm: null, weather: null, risk: null, yield: null,
      score: null, funding: null, tasks: [], events: {},
      lastUpdated: new Date(nowMs).toISOString(),
      error: 'missing_farm_id',
    });
  }

  const [farm, events] = await Promise.all([
    loadFarm(prisma, farmId),
    loadEvents(prisma, farmId),
  ]);

  const eventStats = deriveEventStats(events, { nowMs });
  const stage = (farm && (farm.stage || farm.cropStage)) || null;
  const crop  = (farm && (farm.cropType || farm.crop)) || null;

  const weather = (typeof weatherFor === 'function'
    ? weatherFor({ id: farmId, stage, crop })
    : null) || { rainExpected: false, extremeHeat: false };

  const risk = calculateRisk({
    weather,
    completionRate: eventStats.completionRate,
    stage,
  });

  const rainfall = Number.isFinite(weather.rainfall)
    ? weather.rainfall
    : (weather.rainExpected ? 25 : 15);
  const yieldE = estimateYield({
    crop, rainfall, completionRate: eventStats.completionRate,
  });

  const scored = computeScore({
    completionRate:  eventStats.completionRate,
    consistencyDays: eventStats.consistencyDays,
    riskLevel:       risk.level,
    farmEventsCount: eventStats.total,
  });
  const funding = getFundingDecision(scored.score);

  const tasks = farm ? generateBasicTasks(farm) : [];

  return Object.freeze({
    farm: farm || null,
    weather,
    risk,
    yield: yieldE,
    score: scored,
    funding,
    tasks,
    events: eventStats,
    lastUpdated: new Date(nowMs).toISOString(),
  });
}

const _internal = { loadFarm, loadEvents };
export { getFarmContext, deriveEventStats, generateBasicTasks, _internal };
export default { getFarmContext, deriveEventStats, generateBasicTasks, _internal };
