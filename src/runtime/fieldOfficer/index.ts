/**
 * src/runtime/fieldOfficer/index.ts — Farroway Field Officer
 * workflow barrel + global install.
 *
 *   import {
 *     // engine
 *     startVisit, addNote, attachEvidence, completeIntervention,
 *     listOpen, listCompleted, syncQueueDepth,
 *     // health + boot
 *     fieldOfficerHealth, installFieldOfficerGlobal,
 *     // contracts
 *     FIELD_OFFICER_RUNTIME_VERSION, FIELD_OFFICER_STORAGE_KEY,
 *     INTERVENTION_STATUS, INTERVENTION_CHANNEL,
 *     type InterventionRecord, type InterventionStatus,
 *     type InterventionChannel,
 *   } from 'src/runtime/fieldOfficer';
 *
 *   installFieldOfficerGlobal();   // pins window.__fieldOfficerHealth
 *
 * Strict-rule audit
 *   • Pure composition barrel. No engine logic in this file.
 *   • SSR-safe. Never throws.
 */

export {
  FIELD_OFFICER_RUNTIME_VERSION,
  FIELD_OFFICER_STORAGE_KEY,
  INTERVENTION_STATUS,
  INTERVENTION_CHANNEL,
} from './fieldOfficerContracts';

export type {
  InterventionRecord,
  InterventionStatus,
  InterventionChannel,
  InterventionNote,
  InterventionEvidence,
} from './fieldOfficerContracts';

export {
  startVisit,
  addNote,
  attachEvidence,
  completeIntervention,
  listOpen,
  listCompleted,
  syncQueueDepth,
  fieldOfficerHealth,
  installFieldOfficerGlobal,
} from './FieldOfficerRuntime';
