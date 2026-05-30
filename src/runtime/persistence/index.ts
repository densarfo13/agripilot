/**
 * src/runtime/persistence/index.ts — barrel.
 */

// Wave-38 facade — renamed from PersistenceRuntime.ts to
// ProductionPersistenceRuntime.ts to avoid case-clash with the
// pre-existing wave-5 persistenceRuntime.js on case-insensitive
// filesystems (Rollup resolves either casing to the same module).
export {
  persistenceHealth, refreshPersistenceHealth,
  requireWritablePersistence, isWritablePersistenceReady,
  installPersistenceGlobal,
  installPersistenceHealthGlobal,
} from './ProductionPersistenceRuntime';

export {
  PERSISTENCE_RUNTIME_VERSION,
  PERSISTENCE_MODE,
  SAFE_503_MESSAGE,
  REQUIRED_PRISMA_MODELS,
  type PersistenceModeValue,
  type PersistenceHealth,
  type PersistenceGuardResult,
} from './persistenceContracts';
