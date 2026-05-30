/**
 * src/runtime/persistence/PersistenceRuntime.ts — top-level
 * facade for the Persistence runtime. Composes the health probe
 * + guard.
 *
 *   import {
 *     persistenceHealth, refreshPersistenceHealth,
 *     requireWritablePersistence, isWritablePersistenceReady,
 *     installPersistenceGlobal,
 *   } from 'src/runtime/persistence';
 */

export {
  persistenceHealth, refreshPersistenceHealth,
  installPersistenceHealthGlobal,
} from './PersistenceHealth';

export {
  requireWritablePersistence, isWritablePersistenceReady,
} from './PersistenceGuard';

// One-shot composite install — pins __persistenceHealth +
// __refreshPersistenceHealth, kicks off the boot probe.
import { installPersistenceHealthGlobal } from './PersistenceHealth';
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function installPersistenceGlobal(): boolean {
  return _safe(() => installPersistenceHealthGlobal(), false);
}
