/**
 * src/runtime/knowledgeContent/KnowledgeContentRuntime.ts
 * Knowledge Expansion Framework — read-only catalog coverage probe.
 *
 *   import { knowledgeContentHealth,
 *            installKnowledgeContentGlobal,
 *            KNOWLEDGE_CONTENT_RUNTIME_VERSION }
 *     from 'src/runtime/knowledgeContent/KnowledgeContentRuntime';
 *
 *   window.__knowledgeHealth()
 *     → { runtimeVersion, knowledgeCoverageReady: true,
 *         plants, flowers, diseases, pests,
 *         targets, targetCoveragePercent }
 *
 * What this is
 * ────────────
 *   Composition-only runtime. Counts plants / flowers / diseases /
 *   pests by reading the four EXISTING catalog files:
 *     • src/data/plants/knowledge.js   — PLANT_KNOWLEDGE map
 *     • src/data/plants/flowers.json   — flower entries array
 *     • src/data/diseases/diseases.json — disease entries array
 *     • src/data/pests/pests.json      — pest entries array
 *
 *   If a count fails (file shape changed, import failed, JSON
 *   malformed) that bucket defaults to 0 and a stable countError
 *   string is surfaced in the envelope.
 *
 *   Coverage score is a weighted average of bucket-vs-target
 *   ratios, clamped to 0-100 and rounded to the nearest integer.
 *
 * Strict-rule audit
 *   • Read-only. No localStorage writes. No new server routes.
 *   • SSR-safe — every external access wrapped.
 *   • Pure runtime. _safe() guards every public boundary; never
 *     throws.
 *   • Frozen envelopes.
 *   • No PII written or read.
 *   • Single window global pinned: window.__knowledgeHealth.
 */

import {
  KNOWLEDGE_CONTENT_TARGETS,
  KNOWLEDGE_CONTENT_TARGET_WEIGHTS,
  type KnowledgeContentTargets,
} from './knowledgeContentContracts';

// Catalog imports — composition through the canonical Knowledge
// Layer (src/knowledge/) per check:knowledge-layer purity rule.
// Plants come from PLANT_KNOWLEDGE (the catalog is the source of
// truth for the 250-plant target) and the disease/pest counts
// route through listDiseases / listPests so this runtime stays
// behind the knowledge-layer abstraction. flowers.json doesn't
// flow through the knowledge layer today, but reading it as a
// JSON array is allowed (flowers are media catalog, not
// knowledge-layer entities).
// @ts-ignore — JS module
import { PLANT_KNOWLEDGE } from '../../data/plants/knowledge.js';
// @ts-ignore — JSON module (flowers are media-layer, not knowledge-layer)
import flowersCatalog   from '../../data/plants/flowers.json';
import { listDiseases, listPests } from '../../knowledge';

export const KNOWLEDGE_CONTENT_RUNTIME_VERSION =
  'knowledge-content-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

// ─── bucket counters ────────────────────────────────────────────
// Each returns { count, error } so the envelope can surface the
// first failure without dropping the rest of the buckets.

interface CountResult {
  count: number;
  error: string | null;
}

function _countPlants(): CountResult {
  return _safe<CountResult>(() => {
    if (!PLANT_KNOWLEDGE || typeof PLANT_KNOWLEDGE !== 'object') {
      return { count: 0, error: 'PLANT_KNOWLEDGE shape invalid' };
    }
    const n = Object.keys(PLANT_KNOWLEDGE).length;
    return { count: n, error: null };
  }, { count: 0, error: 'PLANT_KNOWLEDGE read failed' });
}

function _countArrayCatalog(
  catalog: unknown,
  label: string,
): CountResult {
  return _safe<CountResult>(() => {
    if (!Array.isArray(catalog)) {
      return { count: 0, error: `${label} not an array` };
    }
    return { count: catalog.length, error: null };
  }, { count: 0, error: `${label} read failed` });
}

// ─── coverage score ─────────────────────────────────────────────

function _clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function _ratio(have: number, target: number): number {
  if (!Number.isFinite(have) || !Number.isFinite(target)) return 0;
  if (target <= 0) return 0;
  return _clamp01(have / target);
}

function _computeCoveragePercent(
  counts:  KnowledgeContentTargets,
  targets: KnowledgeContentTargets,
): number {
  return _safe(() => {
    const w = KNOWLEDGE_CONTENT_TARGET_WEIGHTS;
    const weighted =
      _ratio(counts.plants,   targets.plants)   * w.plants   +
      _ratio(counts.flowers,  targets.flowers)  * w.flowers  +
      _ratio(counts.diseases, targets.diseases) * w.diseases +
      _ratio(counts.pests,    targets.pests)    * w.pests;
    const pct = Math.round(_clamp01(weighted) * 100);
    if (!Number.isFinite(pct)) return 0;
    return pct;
  }, 0);
}

// ─── public envelope ────────────────────────────────────────────

function _frozenFallback() {
  return Object.freeze({
    runtimeVersion:         KNOWLEDGE_CONTENT_RUNTIME_VERSION,
    knowledgeCoverageReady: false,
    plants:   0,
    flowers:  0,
    diseases: 0,
    pests:    0,
    targets:  KNOWLEDGE_CONTENT_TARGETS,
    targetCoveragePercent:  0,
    countError:             'envelope build failed',
  });
}

export function knowledgeContentHealth() {
  return _safe(() => {
    const p = _countPlants();
    const f = _countArrayCatalog(flowersCatalog,  'flowers');
    // Canonical Knowledge Layer list helpers — frozen arrays.
    const d = _countArrayCatalog(_safe(() => listDiseases(), []), 'diseases');
    const x = _countArrayCatalog(_safe(() => listPests(),    []), 'pests');

    const counts: KnowledgeContentTargets = Object.freeze({
      plants:   p.count,
      flowers:  f.count,
      diseases: d.count,
      pests:    x.count,
    });

    const pct = _computeCoveragePercent(
      counts, KNOWLEDGE_CONTENT_TARGETS,
    );

    // First non-null error wins — deterministic surface for the
    // health snapshot.
    const firstError =
         p.error || f.error || d.error || x.error || null;

    const env: Record<string, unknown> = {
      runtimeVersion:         KNOWLEDGE_CONTENT_RUNTIME_VERSION,
      knowledgeCoverageReady: true,
      plants:   counts.plants,
      flowers:  counts.flowers,
      diseases: counts.diseases,
      pests:    counts.pests,
      targets:  KNOWLEDGE_CONTENT_TARGETS,
      targetCoveragePercent:  pct,
    };
    if (firstError) env.countError = firstError;
    return Object.freeze(env);
  }, _frozenFallback());
}

// ─── global install ─────────────────────────────────────────────

export function installKnowledgeContentGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__knowledgeHealth !== 'function') {
      w.__knowledgeHealth = function () {
        const out = knowledgeContentHealth();
        try {
          console.log('[Farroway · Knowledge Coverage]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
