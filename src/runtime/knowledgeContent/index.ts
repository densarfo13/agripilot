/**
 * src/runtime/knowledgeContent/index.ts
 * Knowledge Expansion Framework — barrel + one-shot install.
 *
 *   import { installKnowledgeContentGlobal }
 *     from 'src/runtime/knowledgeContent';
 *
 *   installKnowledgeContentGlobal();
 *
 * What this is
 * ────────────
 *   Single import surface for the Knowledge Expansion Framework.
 *   Re-exports the contract (targets + weights) and the runtime
 *   (envelope + install).
 *
 *   Composition only — no new engines, no new persistence keys,
 *   no new server routes. Counts are derived from the EXISTING
 *   src/data/{plants,diseases,pests} catalog files.
 *
 * Strict-rule audit
 *   • SSR-safe re-exports.
 *   • Single window global pinned by install: __knowledgeHealth.
 *   • Pure composition. No logic in this file.
 */

export {
  KNOWLEDGE_CONTENT_TARGETS,
  KNOWLEDGE_CONTENT_TARGET_WEIGHTS,
  type KnowledgeContentBucket,
  type KnowledgeContentTargets,
  type KnowledgeContentTargetWeights,
} from './knowledgeContentContracts';

export {
  KNOWLEDGE_CONTENT_RUNTIME_VERSION,
  knowledgeContentHealth,
  installKnowledgeContentGlobal,
} from './KnowledgeContentRuntime';
