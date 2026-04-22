/**
 * taskEngine.js — deterministic daily task generator.
 *
 *   generateDailyTasks({ farm, weather, date }) → {
 *     date:  'YYYY-MM-DD',
 *     farmId,
 *     tasks: Task[],     // 1 high + 1–2 medium + optional low
 *   }
 *
 * Task shape (persisted):
 *   {
 *     id:           `${farmId}:${YYYY-MM-DD}:${templateId}`
 *     templateId:   stable template id (for analytics + dedup)
 *     farmId:       echoed
 *     date:         'YYYY-MM-DD'
 *     type:         'irrigation' | 'pest' | 'nutrient' | 'weeding'
 *                    | 'harvest' | 'land_prep' | 'scout' | 'storage'
 *     priority:     'high' | 'medium' | 'low'
 *     title:        string
 *     description:  string
 *     why:          string
 *     status:       'pending' | 'complete' | 'skipped'
 *   }
 *
 * Rules (intentionally simple):
 *   1. Pick the stage pool (crop-specific overrides beat generic).
 *   2. If weather status matches a WEATHER_TEMPLATES entry, prepend
 *      that task as the day's high-priority slot.
 *   3. Otherwise, pick the top-priority template from the pool.
 *   4. Pick 1–2 medium-priority items from what's left.
 *   5. Optionally include 1 low-priority item (50% of days — keyed
 *      off the date so the same farm sees the same plan all day).
 *
 * Pure. No localStorage, no React. The scheduler wraps this with
 * persistence + date rollover.
 */

import { normalizeCrop } from '../../config/crops.js';
import {
  TEMPLATES, GENERIC_FALLBACK, WEATHER_TEMPLATES, ALLOW_BY_FARM_TYPE,
} from './taskTemplates.js';

function canonicalFarmType(t) {
  const s = String(t || 'small_farm').toLowerCase().trim();
  if (s === 'backyard' || s === 'home' || s === 'home_food') return 'backyard';
  if (s === 'commercial' || s === 'large' || s === 'enterprise') return 'commercial';
  return 'small_farm';
}

function canonicalStage(s) {
  const k = String(s || '').toLowerCase().trim();
  return TEMPLATES[k] ? k : null;
}

function ymd(date) {
  // If already YYYY-MM-DD, return as-is — avoids a Date() round-trip
  // that silently shifts the day across UTC/local boundaries.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }
  const d = date instanceof Date ? date : new Date(date || Date.now());
  // Locale-independent YYYY-MM-DD in the caller's local time.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Cheap, deterministic hash so (farmId,date) picks a stable low-task
// slot even when called across re-renders.
function dayHash(farmId, date) {
  const s = `${farmId || 'nofarm'}:${date}`;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function poolFor(stage, crop) {
  const rules = TEMPLATES[stage];
  if (!rules) return { generic: GENERIC_FALLBACK, cropList: [] };
  const cropKey  = normalizeCrop(crop);
  const cropList = (rules.crops && cropKey && rules.crops[cropKey]) || [];
  return { generic: rules.generic || [], cropList };
}

function filterByType(list, allow) {
  if (!allow) return list;
  return list.filter((x) => allow.has(x.type));
}

function pickByPriority(list, priority) {
  return list.filter((x) => x.priority === priority);
}

function toTask({ template, farmId, date }) {
  return Object.freeze({
    id:          `${farmId || 'nofarm'}:${date}:${template.id}`,
    templateId:  template.id,
    farmId:      farmId || null,
    date,
    type:        template.type,
    priority:    template.priority,
    title:       template.title,
    description: template.description,
    why:         template.why,
    status:      'pending',
  });
}

export function generateDailyTasks({ farm = null, weather = null, date = null } = {}) {
  const dateStr   = ymd(date);
  const farmId    = farm && (farm.id || farm._id) || null;
  const farmType  = canonicalFarmType(farm && farm.farmType);
  const allow     = ALLOW_BY_FARM_TYPE[farmType];
  const stageKey  = canonicalStage(farm && (farm.cropStage || farm.stage))
                 || 'mid_growth';
  const { generic, cropList } = poolFor(stageKey, farm && farm.crop);

  // Crop-specific items sit at the front of the pool (they beat
  // generic for the same priority slot).
  const pool = filterByType([...cropList, ...generic], allow);

  const tasks   = [];
  const usedIds = new Set();

  // ─── 1 HIGH priority task ────────────────────────────────────
  const weatherKey = weather && weather.status;
  const weatherTpl = weatherKey && WEATHER_TEMPLATES[weatherKey];
  let highTpl = null;
  if (weatherTpl && (!allow || allow.has(weatherTpl.type))) {
    highTpl = weatherTpl;
  } else {
    const highPool = pickByPriority(pool, 'high');
    highTpl = highPool[0] || pool[0] || null;
  }
  if (highTpl) {
    tasks.push(toTask({ template: highTpl, farmId, date: dateStr }));
    usedIds.add(highTpl.id);
  }

  // ─── 1–2 MEDIUM priority tasks ───────────────────────────────
  // Commercial farms get 2 medium by default, backyard gets 1 to keep
  // the daily plan short.
  const wantMedium = farmType === 'backyard' ? 1 : 2;
  const mediumPool = pickByPriority(pool, 'medium').filter((x) => !usedIds.has(x.id));
  for (const tpl of mediumPool) {
    if (tasks.filter((x) => x.priority === 'medium').length >= wantMedium) break;
    tasks.push(toTask({ template: tpl, farmId, date: dateStr }));
    usedIds.add(tpl.id);
  }

  // ─── Optional LOW priority task ──────────────────────────────
  // Included on roughly half the days (deterministic per farm × date)
  // so the list doesn't feel overwhelming every single morning.
  const lowPool = pickByPriority(pool, 'low').filter((x) => !usedIds.has(x.id));
  const includeLow = (dayHash(farmId, dateStr) % 2) === 0;
  if (includeLow && lowPool.length > 0) {
    tasks.push(toTask({ template: lowPool[0], farmId, date: dateStr }));
    usedIds.add(lowPool[0].id);
  }

  return Object.freeze({
    date:  dateStr,
    farmId,
    farmType,
    stage: stageKey,
    weatherTrigger: highTpl && highTpl === weatherTpl ? weatherKey : null,
    tasks: Object.freeze(tasks),
  });
}

export const _internal = Object.freeze({
  canonicalFarmType, canonicalStage, ymd, dayHash, poolFor,
  filterByType, pickByPriority, toTask,
});
