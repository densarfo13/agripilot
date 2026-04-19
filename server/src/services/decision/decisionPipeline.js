/**
 * decisionPipeline.js — enforces the canonical execution order
 * for every decision the system makes (recommendations, Today
 * tasks, listing optimization).
 *
 * Pipeline order (priorities are the execution-order index, NOT
 * the runtime priority of a stage's output):
 *
 *   1. HARD_GUARDRAILS        — agronomic safety (never plant
 *                                mango in -20°C, etc.). Locks.
 *   2. MODE_RESTRICTIONS      — backyard vs farm, support tier
 *                                (limited regions filter crops)
 *   3. BASE_LOGIC             — the existing recommendation /
 *                                task / listing engine produces
 *                                its base output
 *   4. OPTIMIZATION           — bias adjustments, scoring tweaks
 *   5. ARBITRATION            — conflict resolution across
 *                                signals; confidence scoring
 *   6. WORDING                — confidence-tier i18n key selection
 *   7. ANALYTICS              — dev-only logging + debug snapshot
 *
 * Key invariant enforced here, not in docs:
 *   A stage cannot override a value a previous stage LOCKED.
 *   Guardrails and mode restrictions produce locks. Optimization
 *   can adjust non-locked values. Arbitration can downgrade
 *   confidence but cannot un-exclude a guardrailed crop.
 *
 * Output shape (DecisionPipelineResult):
 *   {
 *     kind:       'recommendation' | 'task' | 'listing',
 *     contextKey: string,
 *     value:      any,      // final decision value
 *     locks:      { [path]: { lockedBy, reason } },
 *     trace:      [{ stage, priority, changes, elapsedMs }],
 *     confidence: { level, score } | null,
 *     wordingKeys: { [field]: string },
 *     explanation: string[],   // one short line per stage
 *   }
 */

import { PIPELINE_PRIORITY } from './pipelinePriority.js';

/**
 * applyDecisionPipeline — low-level runner. Used by the three
 * specialized pipelines below and exported for tests.
 *
 * @param {object}   input      the domain input (crops map, tasks array, listing, ...)
 * @param {object[]} stages     [{ name, priority, run(state) => partialState }]
 * @param {object}   [opts]
 * @param {string}   [opts.kind='generic']
 * @param {string}   [opts.contextKey]
 */
export function applyDecisionPipeline(input, stages, opts = {}) {
  if (!Array.isArray(stages) || !stages.length) {
    throw new Error('applyDecisionPipeline: at least one stage required');
  }
  const sorted = [...stages].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  let state = {
    kind:       opts.kind || 'generic',
    contextKey: opts.contextKey || null,
    value:      input,
    locks:      {},
    trace:      [],
    confidence: null,
    wordingKeys: {},
    explanation: [],
  };

  for (const stage of sorted) {
    const started = now();
    const before  = snapshot(state);
    let result;
    try {
      result = stage.run(state, input) || {};
    } catch (err) {
      // Never let a single stage crash the pipeline. Record the
      // failure and move on — guardrails already ran.
      state.trace.push({
        stage: stage.name, priority: stage.priority,
        elapsedMs: now() - started,
        error: err?.message || 'stage_threw',
      });
      state.explanation.push(`${stage.name}: failed (${err?.message || 'error'})`);
      continue;
    }
    state = mergeRespectingLocks(state, result, stage);
    state.trace.push({
      stage: stage.name,
      priority: stage.priority,
      elapsedMs: now() - started,
      changes: diffKeys(before, state),
    });
    if (result.explain) state.explanation.push(`${stage.name}: ${result.explain}`);
  }
  return state;
}

/**
 * applyRecommendationDecisionPipeline — produces the final
 * recommendation score map for a (country, crop-set) pair.
 *
 * Input shape:
 *   {
 *     country, mode, supportTier, confidence,
 *     baseEngine: () => { [crop]: score },
 *     optimize:   (scores) => { [crop]: score },  // optional
 *     excludedCrops: string[] | undefined,        // from guardrails
 *     biasedCrops?: string[],                     // regional bias input
 *   }
 */
export async function applyRecommendationDecisionPipeline(input = {}) {
  const stages = [
    {
      name: 'guardrails',
      priority: PIPELINE_PRIORITY.HARD_GUARDRAILS,
      run: (state) => {
        const excluded = new Set(input.excludedCrops || []);
        if (!excluded.size) return { explain: 'no hard exclusions' };
        const next = { ...state.value };
        for (const c of excluded) delete next[c];
        const locks = {};
        for (const c of excluded) locks[`crop:${c}`] = { lockedBy: 'guardrails', reason: 'agronomic_excluded' };
        return { value: next, locks, explain: `excluded ${excluded.size} crops` };
      },
    },
    {
      name: 'mode_restrictions',
      priority: PIPELINE_PRIORITY.MODE_RESTRICTIONS,
      run: (state) => {
        const { mode } = input;
        const next = { ...state.value };
        const locks = {};
        const reasons = [];
        if (mode === 'backyard') {
          // Example: exclude commodity-scale crops in backyard mode.
          // This runs pre-base so the engine never bothers scoring them.
          for (const crop of Object.keys(next)) {
            if (input.commodityCrops?.includes?.(crop)) {
              delete next[crop];
              locks[`crop:${crop}`] = { lockedBy: 'mode_restriction', reason: 'commodity_not_for_backyard' };
              reasons.push(`${crop}:commodity`);
            }
          }
          // Lock future re-adds by name regardless of whether the crop
          // was in the initial value — covers the case where baseEngine
          // tries to introduce one of the banned crops later.
          for (const crop of input.commodityCrops || []) {
            if (!locks[`crop:${crop}`]) {
              locks[`crop:${crop}`] = { lockedBy: 'mode_restriction', reason: 'commodity_not_for_backyard' };
            }
          }
        }
        return { value: next, locks, explain: reasons.length ? reasons.join(',') : 'no pre-base mode restrictions' };
      },
    },
    {
      name: 'base_logic',
      priority: PIPELINE_PRIORITY.BASE_LOGIC,
      run: async (state) => {
        if (typeof input.baseEngine !== 'function') return { explain: 'no base engine — passthrough' };
        const baseScores = await input.baseEngine({ ...state.value });
        const next = { ...state.value };
        for (const [crop, score] of Object.entries(baseScores || {})) {
          if (state.locks[`crop:${crop}`]) continue;   // locked → skip
          next[crop] = Number(score) || 0;
        }
        return { value: next, explain: `engine scored ${Object.keys(baseScores || {}).length}` };
      },
    },
    {
      // Data-dependent mode restrictions — run AFTER the base engine so
      // "cap to top 3 in limited regions" sees the real scores.
      name: 'mode_restrictions_post_base',
      priority: PIPELINE_PRIORITY.BASE_LOGIC + 5,
      run: (state) => {
        if (input.supportTier !== 'limited') return { explain: 'n/a' };
        const entries = Object.entries(state.value || {}).sort(([, a], [, b]) => b - a);
        const keep = new Set(entries.slice(0, 3).map(([c]) => c));
        const next = {};
        const locks = {};
        for (const [crop, score] of entries) {
          if (keep.has(crop)) {
            next[crop] = score;
          } else {
            locks[`crop:${crop}`] = { lockedBy: 'mode_restriction_post_base', reason: 'support_tier_limited' };
          }
        }
        return { value: next, locks, explain: `capped to ${keep.size} for limited region` };
      },
    },
    {
      name: 'optimization',
      priority: PIPELINE_PRIORITY.OPTIMIZATION,
      run: async (state) => {
        if (typeof input.optimize !== 'function') return { explain: 'no optimizer — passthrough' };
        const optimized = await input.optimize({ ...state.value });
        const next = { ...state.value };
        for (const [crop, score] of Object.entries(optimized || {})) {
          if (state.locks[`crop:${crop}`]) continue;  // locked stays locked
          next[crop] = Number(score) || 0;
        }
        return { value: next, explain: 'optimized non-locked scores' };
      },
    },
    {
      name: 'arbitration',
      priority: PIPELINE_PRIORITY.ARBITRATION,
      run: (state) => {
        // Arbitration may downgrade confidence; it cannot un-exclude crops.
        const confidence = input.confidence || { level: 'medium', score: 50 };
        return { confidence, explain: `confidence=${confidence.level}` };
      },
    },
    {
      name: 'wording',
      priority: PIPELINE_PRIORITY.WORDING,
      run: (state) => ({
        wordingKeys: {
          header:    `recommendations.header.${state.confidence?.level || 'medium'}`,
          subheader: `recommendations.sub.${state.confidence?.level || 'medium'}`,
        },
        explain: 'selected i18n keys',
      }),
    },
    {
      name: 'analytics',
      priority: PIPELINE_PRIORITY.ANALYTICS,
      run: () => ({ explain: 'analytics hook' }),
    },
  ];
  // Base engine + optimizer can be async — wrap the runner to await stages
  // that return promises.
  return await runAsync(input, stages, { kind: 'recommendation', contextKey: input.contextKey || null });
}

/**
 * applyTaskDecisionPipeline — produces the final Today primary
 * task. Input shape:
 *   {
 *     tasks:      Task[],                   // baseline candidates
 *     landProfile, weatherNow, cropStage,
 *     confidence, mode, supportTier,
 *     excludeIntents?: string[],            // guardrails
 *   }
 */
export async function applyTaskDecisionPipeline(input = {}) {
  const stages = [
    {
      name: 'guardrails',
      priority: PIPELINE_PRIORITY.HARD_GUARDRAILS,
      run: (state) => {
        const exclude = new Set((input.excludeIntents || []).map((x) => String(x).toLowerCase()));
        const next = (state.value || []).filter((t) =>
          !exclude.has(String(t.intent || t.code || '').toLowerCase()));
        const locks = {};
        for (const intent of exclude) locks[`intent:${intent}`] = { lockedBy: 'guardrails', reason: 'agronomic_excluded' };
        return { value: next, locks, explain: `excluded ${exclude.size} intents` };
      },
    },
    {
      name: 'mode_restrictions',
      priority: PIPELINE_PRIORITY.MODE_RESTRICTIONS,
      run: (state) => {
        if (input.mode !== 'backyard') return { explain: 'no mode restrictions for non-backyard' };
        // Example: drop machinery-scale tasks in backyard
        const next = (state.value || []).filter((t) => !t.requiresMachinery);
        return { value: next, explain: 'filtered machinery tasks' };
      },
    },
    {
      name: 'base_logic',
      priority: PIPELINE_PRIORITY.BASE_LOGIC,
      run: (state) => {
        const tasks = (state.value || []).slice();
        // Keep existing ordering; base logic is whoever provided the list.
        return { value: tasks, explain: `${tasks.length} tasks candidate` };
      },
    },
    {
      name: 'optimization',
      priority: PIPELINE_PRIORITY.OPTIMIZATION,
      run: (state) => {
        if (typeof input.optimize !== 'function') return { explain: 'no optimizer' };
        const optimized = input.optimize((state.value || []).slice());
        return { value: Array.isArray(optimized) ? optimized : state.value, explain: 'reordered by optimizer' };
      },
    },
    {
      name: 'arbitration',
      priority: PIPELINE_PRIORITY.ARBITRATION,
      run: (state) => {
        const confidence = input.confidence || { level: 'medium', score: 50 };
        const primary = Array.isArray(state.value) && state.value.length ? state.value[0] : null;
        return { value: state.value, confidence, explain: primary ? `primary=${primary.intent || primary.code}` : 'no tasks' };
      },
    },
    {
      name: 'wording',
      priority: PIPELINE_PRIORITY.WORDING,
      run: (state) => {
        const primary = Array.isArray(state.value) && state.value.length ? state.value[0] : null;
        if (!primary) return { explain: 'no primary task' };
        const level = state.confidence?.level || 'medium';
        return {
          wordingKeys: {
            title:  primary.titleKey  ? `${primary.titleKey}.${level}`  : null,
            detail: primary.detailKey ? `${primary.detailKey}.${level}` : null,
          },
          explain: `applied ${level} wording tier`,
        };
      },
    },
    { name: 'analytics', priority: PIPELINE_PRIORITY.ANALYTICS, run: () => ({ explain: 'logged' }) },
  ];
  return runAsync(input.tasks || [], stages, { kind: 'task', contextKey: input.contextKey || null });
}

/**
 * applyListingDecisionPipeline — produces the final listing
 * lifecycle state + nudges for the seller. Input:
 *   {
 *     listing: { completenessScore, price, quantity, ... },
 *     confidence,                   // listing confidence
 *     nudges:  [{ field, label }],
 *     excludeStates?: string[],
 *   }
 */
export function applyListingDecisionPipeline(input = {}) {
  const stages = [
    {
      name: 'guardrails',
      priority: PIPELINE_PRIORITY.HARD_GUARDRAILS,
      run: (state) => {
        const l = state.value || {};
        const locks = {};
        const flagged = [];
        if (l.expiresAt && Number(l.expiresAt) <= Date.now()) {
          locks['listing:state'] = { lockedBy: 'guardrails', reason: 'already_expired' };
          flagged.push('expired');
          return { value: { ...l, state: 'expired' }, locks, explain: 'listing expired — locked' };
        }
        return { explain: 'no guardrail locks' };
      },
    },
    {
      name: 'mode_restrictions',
      priority: PIPELINE_PRIORITY.MODE_RESTRICTIONS,
      run: () => ({ explain: 'n/a for listings' }),
    },
    {
      name: 'base_logic',
      priority: PIPELINE_PRIORITY.BASE_LOGIC,
      run: (state) => ({ value: state.value, explain: 'passthrough' }),
    },
    {
      name: 'optimization',
      priority: PIPELINE_PRIORITY.OPTIMIZATION,
      run: (state) => {
        if (typeof input.optimize !== 'function') return { explain: 'no optimizer' };
        const optimized = input.optimize(state.value) || state.value;
        // Honour field-level locks: an optimizer must not un-expire
        // a listing that guardrails locked.
        if (state.locks['listing:state'] && optimized && state.value) {
          optimized.state = state.value.state;
        }
        return { value: optimized, explain: 'listing optimized (respecting locks)' };
      },
    },
    {
      name: 'arbitration',
      priority: PIPELINE_PRIORITY.ARBITRATION,
      run: (state) => ({ confidence: input.confidence || null, explain: 'confidence attached' }),
    },
    {
      name: 'wording',
      priority: PIPELINE_PRIORITY.WORDING,
      run: (state) => {
        const level = state.confidence?.level || 'medium';
        return {
          wordingKeys: { freshness: `listing.freshness.${level}` },
          explain: `listing wording tier=${level}`,
        };
      },
    },
    { name: 'analytics', priority: PIPELINE_PRIORITY.ANALYTICS, run: () => ({ explain: 'logged' }) },
  ];
  // Listings are synchronous — use the simple runner.
  return applyDecisionPipeline(input.listing || {}, stages, {
    kind: 'listing', contextKey: input.contextKey || null,
  });
}

// ─── internals ─────────────────────────────────────────────
async function runAsync(input, stages, opts) {
  const sorted = [...stages].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  let state = {
    kind: opts.kind || 'generic',
    contextKey: opts.contextKey || null,
    value: input,
    locks: {},
    trace: [],
    confidence: null,
    wordingKeys: {},
    explanation: [],
  };
  for (const stage of sorted) {
    const started = now();
    const before = snapshot(state);
    let result;
    try {
      result = (await stage.run(state, input)) || {};
    } catch (err) {
      state.trace.push({ stage: stage.name, priority: stage.priority, elapsedMs: now() - started, error: err?.message });
      state.explanation.push(`${stage.name}: failed`);
      continue;
    }
    state = mergeRespectingLocks(state, result, stage);
    state.trace.push({
      stage: stage.name,
      priority: stage.priority,
      elapsedMs: now() - started,
      changes: diffKeys(before, state),
    });
    if (result.explain) state.explanation.push(`${stage.name}: ${result.explain}`);
  }
  return state;
}

function mergeRespectingLocks(state, partial, stage) {
  const next = { ...state };
  if (partial.value !== undefined)       next.value = partial.value;
  if (partial.confidence !== undefined)  next.confidence = partial.confidence;
  if (partial.wordingKeys)               next.wordingKeys = { ...state.wordingKeys, ...partial.wordingKeys };
  if (partial.locks) {
    next.locks = { ...state.locks };
    for (const [k, v] of Object.entries(partial.locks)) {
      // First writer wins. A later stage cannot re-lock a key.
      if (!next.locks[k]) next.locks[k] = { ...v, lockedBy: v.lockedBy || stage.name };
    }
  }
  return next;
}

function snapshot(state) {
  return {
    value: state.value,
    confidence: state.confidence,
    lockCount: Object.keys(state.locks || {}).length,
    wordingCount: Object.keys(state.wordingKeys || {}).length,
  };
}

function diffKeys(a, b) {
  const changed = [];
  if (JSON.stringify(a.value) !== JSON.stringify(b.value)) changed.push('value');
  if (JSON.stringify(a.confidence) !== JSON.stringify(b.confidence)) changed.push('confidence');
  if (a.lockCount !== Object.keys(b.locks || {}).length) changed.push('locks');
  if (a.wordingCount !== Object.keys(b.wordingKeys || {}).length) changed.push('wordingKeys');
  return changed;
}

function now() { return Date.now(); }

export const _internal = { mergeRespectingLocks, diffKeys, snapshot };
