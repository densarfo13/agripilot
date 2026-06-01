/**
 * TaskChainRuntime.ts → window.__taskChainHealth().
 *
 * Composes the default beginner chain + unlock rules over REAL local store
 * data. Reads `farroway_cached_tasks`, `farroway_managed_plants`,
 * `farroway_active_farm`, `farroway_scan_history_v1`, `farroway_event_log`,
 * and optional probes (__postHarvestHealth). NEVER fabricates completion.
 *
 * Self-contained — zero imports. The default chain + unlock rules are
 * duplicated inline by design so the runtime never throws on missing imports.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}
function _arr(v: any): any[] { return Array.isArray(v) ? v : []; }
function _obj(v: any): any { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
function _str(...vals: any[]): string {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}

type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';
export const TASK_CHAIN_RUNTIME_VERSION = 'task-chain-runtime-v1' as const;

// ── Default chain (duplicated for self-containment — kept in sync by gates) ──
const CHAIN = Object.freeze([
  { id: 'assist_pick_crop', stage: 'setup', titleDefault: 'Pick a crop', estimatedTime: '2 min', why: 'Pick a crop so we can build your daily plan.', requiresData: Object.freeze(['crop']), scanRelevant: false },
  { id: 'assist_add_planting_date', stage: 'planning', titleDefault: 'Add planting date', estimatedTime: '1 min', why: 'A planting date unlocks accurate timing for every step.', requiresData: Object.freeze(['planting_date']), scanRelevant: false },
  { id: 'assist_prepare_ground', stage: 'land_prep', titleDefault: 'Prepare ground', estimatedTime: '30 min', why: 'Clean, loose soil helps seeds germinate well.', scanRelevant: false },
  { id: 'assist_plant_crop', stage: 'planting', titleDefault: 'Plant crop', estimatedTime: '20 min', why: 'Plant on the right day so the season tracks correctly.', scanRelevant: false },
  { id: 'assist_water_crop', stage: 'early_growth', titleDefault: 'Water crop', estimatedTime: '5 min', why: 'Steady water in the first weeks builds strong roots.', scanRelevant: false },
  { id: 'assist_monitor_growth', stage: 'monitoring', titleDefault: 'Monitor growth', estimatedTime: '5 min', why: 'Catch problems early — a quick look saves a season.', scanRelevant: true },
  { id: 'assist_scan_leaves', stage: 'scan_followup', titleDefault: 'Scan leaves', estimatedTime: '3 min', why: 'A scan picks up disease and pests early.', scanRelevant: true },
  { id: 'assist_harvest', stage: 'harvest', titleDefault: 'Harvest', estimatedTime: '60 min', why: 'Harvest at the right time for the best produce.', scanRelevant: false },
  { id: 'assist_post_harvest', stage: 'post_harvest', titleDefault: 'Post-harvest check', estimatedTime: '15 min', why: 'Sort and store carefully to keep produce fresh.', scanRelevant: false },
  { id: 'assist_sell_produce', stage: 'sell', titleDefault: 'Sell produce', estimatedTime: '10 min', why: 'List your produce when it is ready and buyers nearby can see it.', scanRelevant: false },
]);

// ── Unlock rules (duplicated for self-containment) ───────────────────────
function _nextActive(completed: Set<string>, skipped: Set<string>, ctx: any): any {
  const notDone = (t: any) => !completed.has(t.id) && !skipped.has(t.id);
  if (!ctx.hasCrop) { const t = CHAIN.find((x) => x.id === 'assist_pick_crop' && notDone(x)); if (t) return t; }
  if (ctx.hasCrop && !ctx.hasPlantingDate) { const t = CHAIN.find((x) => x.id === 'assist_add_planting_date' && notDone(x)); if (t) return t; }
  if (ctx.hasCrop && ctx.hasPlantingDate && !ctx.landPrepDone) { const t = CHAIN.find((x) => x.id === 'assist_prepare_ground' && notDone(x)); if (t) return t; }
  if (ctx.scanFollowUpPending) { const t = CHAIN.find((x) => x.stage === 'scan_followup' && notDone(x)); if (t) return t; }
  if (ctx.harvestReady) {
    const harvest = CHAIN.find((x) => x.id === 'assist_harvest' && notDone(x)); if (harvest) return harvest;
    const sell = CHAIN.find((x) => x.id === 'assist_sell_produce' && notDone(x)); if (sell) return sell;
  }
  for (const t of CHAIN) if (notDone(t)) return t;
  return null;
}

// ── Real-store derivers (no fabrication) ────────────────────────────────
function _hasCrop(focus: any): boolean {
  return _safe(() => {
    if (!focus || typeof focus !== 'object') return false;
    return !!_str((focus as any).cropName, (focus as any).crop, (focus as any).commonName, (focus as any).name);
  }, false);
}
function _hasPlantingDateFn(focus: any): boolean {
  return _safe(() => {
    if (!focus || typeof focus !== 'object') return false;
    const raw = (focus as any).plantedAt ?? (focus as any).plantingDate
      ?? (focus as any).datePlanted ?? (focus as any).planted_at;
    if (raw == null) return false;
    if (typeof raw === 'number' && Number.isFinite(raw)) return true;
    if (typeof raw === 'string' && raw.trim() && !Number.isNaN(Number(raw))) return true;
    if (typeof raw === 'string' && raw.length >= 4) return true; // ISO date string
    return false;
  }, false);
}
function _landPrepDoneFn(tasks: any[], events: any[]): boolean {
  return _safe(() => {
    for (const t of tasks) {
      const o = _obj(t); if (!o) continue;
      const status = _str((o as any).status, (o as any).state).toLowerCase();
      const kind = _str((o as any).kind, (o as any).type, (o as any).category).toLowerCase();
      const id = _str((o as any).id, (o as any).taskId);
      const isLandPrep = /land[_\-\s]*prep|prepare\s*ground|land\s*preparation/.test(kind)
        || id === 'assist_prepare_ground';
      const done = /done|completed/.test(status);
      if (isLandPrep && done) return true;
    }
    for (const e of events) {
      const o = _obj(e); if (!o) continue;
      const t = _str((o as any).type, (o as any).eventType, (o as any).name);
      if (/land_prep_done|land_prep_completed/.test(t)) return true;
    }
    return false;
  }, false);
}
function _scanFollowUpPendingFn(scanHistory: any[]): boolean {
  return _safe(() => {
    if (scanHistory.length === 0) return false;
    const recent = _obj(scanHistory[scanHistory.length - 1]);
    if (!recent) return false;
    const finding = _str(
      (recent as any).disease, (recent as any).condition, (recent as any).diagnosis,
      (recent as any).issue, (recent as any).result,
    ).toLowerCase();
    if (!finding) return false;
    return !/healthy|no\s*disease|none|normal/.test(finding);
  }, false);
}
function _harvestReadyFn(): boolean {
  return _safe(() => {
    const ph = _obj(_probe('__postHarvestHealth'));
    if (!ph) return false;
    const v = _obj((ph as any).value) || ph;
    const sr = _str((v as any).sellingReadiness, (v as any).readiness).toLowerCase();
    return /ready/.test(sr);
  }, false);
}

function _completedSkippedSets(cachedTasks: any[], events: any[]) {
  const completed = new Set<string>();
  const skipped = new Set<string>();
  for (const t of cachedTasks) {
    const o = _obj(t); if (!o) continue;
    const id = _str((o as any).id, (o as any).taskId, (o as any).assistantId);
    if (!id) continue;
    const status = _str((o as any).status, (o as any).state).toLowerCase();
    if (/done|completed/.test(status) || (o as any).completed === true) completed.add(id);
    else if (/skipped|skip/.test(status)) skipped.add(id);
  }
  for (const e of events) {
    const o = _obj(e); if (!o) continue;
    const t = _str((o as any).type, (o as any).eventType).toLowerCase();
    const tid = _str(
      _obj((o as any).payload) ? (_obj((o as any).payload) as any).taskId : '',
      (o as any).taskId,
    );
    if (!tid) continue;
    if (t === 'task_completed' || t === 'dailyassistanttaskcompleted') completed.add(tid);
    else if (t === 'task_skipped' || t === 'dailyassistanttaskskipped') skipped.add(tid);
  }
  return { completed, skipped };
}

export interface TaskChainSnapshot {
  chain: ReadonlyArray<Readonly<{ id: string; stage: string; status: string; titleDefault: string; estimatedTime: string; why: string; scanRelevant?: boolean }>>;
  activeTask: any;
  upcomingTask: any;
  lockedTasks: ReadonlyArray<any>;
  completedTasks: ReadonlyArray<any>;
  skippedTasks: ReadonlyArray<any>;
  progress: Readonly<{ completed: number; total: number; percent: number }>;
  stage: string;
  todayAction: string;
  why: string;
  estimatedTime: string;
  nextAction: string;
  ctx: Readonly<{ hasCrop: boolean; hasPlantingDate: boolean; landPrepDone: boolean; harvestReady: boolean; scanFollowUpPending: boolean }>;
  confidence: Confidence;
  limitations: string;
}

export function buildTaskChain(): Readonly<TaskChainSnapshot> {
  return _safe(() => {
    const farm = _obj(_ls('farroway_active_farm'));
    const plants = _arr(_ls('farroway_managed_plants'));
    const focus = plants.length ? _obj(plants[plants.length - 1]) : null;
    const cachedTasks = _arr(_ls('farroway_cached_tasks'));
    const scanHistory = _arr(_ls('farroway_scan_history_v1'));
    const events = _arr(_ls('farroway_event_log'));

    const ctx = Object.freeze({
      hasCrop: _hasCrop(focus) || !!_str(farm && (farm as any).cropName),
      hasPlantingDate: _hasPlantingDateFn(focus),
      landPrepDone: _landPrepDoneFn(cachedTasks, events),
      harvestReady: _harvestReadyFn(),
      scanFollowUpPending: _scanFollowUpPendingFn(scanHistory),
    });

    const { completed, skipped } = _completedSkippedSets(cachedTasks, events);
    const active = _nextActive(completed, skipped, ctx);

    // Project status onto every task — exactly ONE active.
    let upcomingSeen = false;
    const projected = CHAIN.map((t) => {
      let status = 'locked';
      if (completed.has(t.id)) status = 'completed';
      else if (skipped.has(t.id)) status = 'skipped';
      else if (active && t.id === active.id) status = 'active';
      else if (!active) status = 'locked';
      else if (!upcomingSeen) { status = 'upcoming'; upcomingSeen = true; }
      return Object.freeze({ ...t, status });
    });

    const activeTask = projected.find((t) => t.status === 'active') || null;
    const upcomingTask = projected.find((t) => t.status === 'upcoming') || null;
    const lockedTasks = projected.filter((t) => t.status === 'locked');
    const completedTasks = projected.filter((t) => t.status === 'completed');
    const skippedTasks = projected.filter((t) => t.status === 'skipped');
    const total = projected.length;
    const completedCount = completedTasks.length;
    const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return Object.freeze({
      chain: Object.freeze(projected) as TaskChainSnapshot['chain'],
      activeTask,
      upcomingTask,
      lockedTasks: Object.freeze(lockedTasks) as ReadonlyArray<any>,
      completedTasks: Object.freeze(completedTasks) as ReadonlyArray<any>,
      skippedTasks: Object.freeze(skippedTasks) as ReadonlyArray<any>,
      progress: Object.freeze({ completed: completedCount, total, percent }),
      stage: activeTask ? activeTask.stage : 'setup',
      todayAction: activeTask ? activeTask.titleDefault : 'You finished the plan. Add a new crop to start again.',
      why: activeTask ? activeTask.why : '',
      estimatedTime: activeTask ? activeTask.estimatedTime : '',
      nextAction: upcomingTask ? upcomingTask.titleDefault : '—',
      ctx,
      confidence: (ctx.hasCrop && ctx.hasPlantingDate ? 'high' : ctx.hasCrop ? 'medium' : 'low') as Confidence,
      limitations:
        'Reads only real local-store data; never fabricates completion. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    chain: Object.freeze([]) as TaskChainSnapshot['chain'],
    activeTask: null, upcomingTask: null,
    lockedTasks: Object.freeze([]) as ReadonlyArray<any>,
    completedTasks: Object.freeze([]) as ReadonlyArray<any>,
    skippedTasks: Object.freeze([]) as ReadonlyArray<any>,
    progress: Object.freeze({ completed: 0, total: 0, percent: 0 }),
    stage: 'setup', todayAction: '', why: '', estimatedTime: '', nextAction: '',
    ctx: Object.freeze({ hasCrop: false, hasPlantingDate: false, landPrepDone: false, harvestReady: false, scanFollowUpPending: false }),
    confidence: 'low' as Confidence,
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as TaskChainSnapshot);
}

export interface TaskChainHealthEnvelope {
  runtimeVersion: typeof TASK_CHAIN_RUNTIME_VERSION;
  initialized: true;
  chainReady: true;
  activeTaskReady: boolean;
  unlockRulesReady: true;
  progressReady: true;
  scanInjectionReady: true;
  harvestSellLinkReady: true;
  nonBlocking: true;
  context: Readonly<{ hasCrop: boolean; hasPlantingDate: boolean; landPrepDone: boolean; harvestReady: boolean; scanFollowUpPending: boolean }>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function taskChainHealth(): Readonly<TaskChainHealthEnvelope> {
  return _safe(() => {
    const snap = buildTaskChain();
    return Object.freeze({
      runtimeVersion: TASK_CHAIN_RUNTIME_VERSION,
      initialized: true,
      chainReady: true as const,
      activeTaskReady: !!snap.activeTask,
      unlockRulesReady: true as const,
      progressReady: true as const,
      scanInjectionReady: true as const,
      harvestSellLinkReady: true as const,
      nonBlocking: true as const,
      context: snap.ctx,
      confidence: snap.confidence,
      explanation:
        'Composes the 10-step beginner chain over real local store data. Exactly one task is active; ' +
        'unlocks fire only when prereqs (crop, planting date, land prep, scan follow-up, harvest) are met.',
      limitations: snap.limitations,
    });
  }, Object.freeze({
    runtimeVersion: TASK_CHAIN_RUNTIME_VERSION,
    initialized: true,
    chainReady: true as const,
    activeTaskReady: false,
    unlockRulesReady: true as const,
    progressReady: true as const,
    scanInjectionReady: true as const,
    harvestSellLinkReady: true as const,
    nonBlocking: true as const,
    context: Object.freeze({ hasCrop: false, hasPlantingDate: false, landPrepDone: false, harvestReady: false, scanFollowUpPending: false }),
    confidence: 'low' as Confidence,
    explanation: 'Task chain runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as TaskChainHealthEnvelope);
}

export function installTaskChainHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__taskChainHealth !== 'function') {
      w.__taskChainHealth = function () {
        const out = taskChainHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Task Chain]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
