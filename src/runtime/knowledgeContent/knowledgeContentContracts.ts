/**
 * src/runtime/knowledgeContent/knowledgeContentContracts.ts
 * Knowledge Expansion Framework — target contract.
 *
 *   import { KNOWLEDGE_CONTENT_TARGETS,
 *            KNOWLEDGE_CONTENT_TARGET_WEIGHTS }
 *     from 'src/runtime/knowledgeContent/knowledgeContentContracts';
 *
 * What this is
 * ────────────
 *   Frozen catalog-coverage targets used by the Knowledge Content
 *   Runtime to compute targetCoveragePercent. The runtime composes
 *   counts over the EXISTING data files in src/data/{plants,
 *   diseases,pests}; it does not own a new catalog.
 *
 *   Weights drive the weighted-average coverage score:
 *     plants    0.50
 *     flowers   0.20
 *     diseases  0.15
 *     pests     0.15
 *
 * Strict-rule audit
 *   • Pure data module. No side effects, no I/O.
 *   • Frozen envelopes for both targets + weights.
 *   • SSR-safe (no window / localStorage references).
 *   • No PII.
 */

export type KnowledgeContentBucket =
  | 'plants'
  | 'flowers'
  | 'diseases'
  | 'pests';

export interface KnowledgeContentTargets {
  readonly plants:   number;
  readonly flowers:  number;
  readonly diseases: number;
  readonly pests:    number;
}

export interface KnowledgeContentTargetWeights {
  readonly plants:   number;
  readonly flowers:  number;
  readonly diseases: number;
  readonly pests:    number;
}

export const KNOWLEDGE_CONTENT_TARGETS: KnowledgeContentTargets =
  Object.freeze({
    plants:   250,
    flowers:   50,
    diseases:  30,
    pests:     30,
  });

export const KNOWLEDGE_CONTENT_TARGET_WEIGHTS:
  KnowledgeContentTargetWeights = Object.freeze({
    plants:   0.50,
    flowers:  0.20,
    diseases: 0.15,
    pests:    0.15,
  });
