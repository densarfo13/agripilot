/**
 * DEPRECATED — this v1 module is preserved only as a re-export shim so
 * existing imports continue to work. The canonical owner of
 * window.__commandCenterHealth lives at:
 *
 *   src/runtime/command-center/CommandCenterRuntime.ts
 *
 * It composes Aggregator + Selectors + Contracts per the production-fix
 * spec. New code should import from the spec-canonical path.
 */

export {
  commandCenterHealth,
  installCommandCenterRuntimeGlobal as installCommandCenterGlobal,
  recordCommandCenterIntegration,
  COMMAND_CENTER_VERSION,
} from '../command-center/CommandCenterRuntime';

export type { CommandCenterDiagnostics as CommandCenterEnvelope }
  from '../command-center/CommandCenterContracts';
